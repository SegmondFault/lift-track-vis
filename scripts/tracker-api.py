#!/usr/bin/env python3
import json
import importlib.util
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
VISUALIZER_PATH = ROOT / "visualizer" / "index.html"

GROUND_TRUTH_PATH = ROOT / "scripts" / "build-mac-ground-truth.py"
spec = importlib.util.spec_from_file_location("build_mac_ground_truth", GROUND_TRUTH_PATH)
ground_truth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ground_truth)

OUTPUT_FILE = ROOT / "data" / "imports" / "most-recent.full-backup.json"
ALLOWED_TABLES = {"workout_session", "lift_set", "body_metric_entry", "body_measurement_entry", "app_metadata"}
DELETABLE_TABLES = {"lift_set", "body_metric_entry", "body_measurement_entry"}


def response_body(payload):
    return json.dumps(payload, indent=2).encode("utf-8")


class TrackerApiHandler(BaseHTTPRequestHandler):
    server_version = "WorkoutTrackerApi/1.0"

    def log_message(self, format, *args):
        return

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin:
            origin_host = urlparse(origin).hostname
            request_host = (self.headers.get("Host") or "").split(":", 1)[0]
            if origin_host in {"localhost", "127.0.0.1"} or origin_host == request_host:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def send_html(self, path):
        if not path.exists():
            self.send_json(404, {"ok": False, "error": "Visualizer not found."})
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, payload):
        body = response_body(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path in {"/", "/visualizer", "/visualizer/"}:
            self.send_html(VISUALIZER_PATH)
            return
        if path == "/api/status":
            self.send_json(
                200,
                {
                    "ok": True,
                    "databaseReady": ground_truth.DB_PATH.exists(),
                    "exportReady": OUTPUT_FILE.exists(),
                },
            )
            return
        if path == "/api/export":
            if not OUTPUT_FILE.exists():
                self.send_json(404, {"ok": False, "error": "No export has been generated yet."})
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(OUTPUT_FILE.stat().st_size))
            self.end_headers()
            self.wfile.write(OUTPUT_FILE.read_bytes())
            return
        self.send_json(404, {"ok": False, "error": "Unknown endpoint."})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/delete-row":
            self.delete_row()
            return
        if path != "/api/desktop-log":
            self.send_json(404, {"ok": False, "error": "Unknown endpoint."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as error:
            self.send_json(400, {"ok": False, "error": f"Invalid JSON: {error}"})
            return

        raw_tables = payload.get("tables") or {}
        tables = {name: rows for name, rows in raw_tables.items() if name in ALLOWED_TABLES and isinstance(rows, list)}
        if not any(tables.values()):
            self.send_json(400, {"ok": False, "error": "No desktop log rows supplied."})
            return

        export_id = payload.get("exportId") or f"desktop-auto-{ground_truth.now_iso()}"
        backup = {
            "schemaVersion": payload.get("schemaVersion") or 2,
            "exportId": export_id,
            "exportedAt": payload.get("exportedAt") or ground_truth.now_iso(),
            "createdOnDeviceAt": payload.get("createdOnDeviceAt") or payload.get("exportedAt") or ground_truth.now_iso(),
            "latestSetLoggedAt": payload.get("latestSetLoggedAt"),
            "format": "lifting-tracker-full-backup-json",
            "notes": "Desktop autosave through local Workout Tracker API.",
            "tables": tables,
        }

        try:
            conn = ground_truth.connect()
            with conn:
                imported_export_id, imported_rows = ground_truth.import_backup(
                    conn,
                    backup,
                    "desktop-autosave-api",
                    replace_tables=False,
                )
                visualizer_export_id, visualizer_rows = ground_truth.export_backup(conn, OUTPUT_FILE)
            generated_backup = json.loads(OUTPUT_FILE.read_text())
        except Exception as error:
            self.send_json(500, {"ok": False, "error": f"Autosave failed: {error}"})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "importedExportId": imported_export_id,
                "importedRows": imported_rows,
                "visualizerExportId": visualizer_export_id,
                "visualizerRows": visualizer_rows,
                "backup": generated_backup,
            },
        )

    def delete_row(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as error:
            self.send_json(400, {"ok": False, "error": f"Invalid JSON: {error}"})
            return

        table_name = payload.get("tableName")
        row_id = payload.get("rowId")
        if table_name not in DELETABLE_TABLES or not row_id:
            self.send_json(400, {"ok": False, "error": "Provide a deletable tableName and rowId."})
            return

        try:
            conn = ground_truth.connect()
            with conn:
                existing = conn.execute(
                    "SELECT payload_json, source_export_id FROM mac_table_row WHERE table_name = ? AND row_id = ?",
                    (table_name, row_id),
                ).fetchone()
                if not existing:
                    self.send_json(404, {"ok": False, "error": "Row not found."})
                    return
                row = json.loads(existing[0])
                now = ground_truth.now_iso()
                row["deleted_at"] = now
                row["updated_at"] = now
                conn.execute(
                    """
                    UPDATE mac_table_row
                    SET payload_json = ?, updated_at = ?
                    WHERE table_name = ? AND row_id = ?
                    """,
                    (json.dumps(row, sort_keys=True), now, table_name, row_id),
                )
                visualizer_export_id, visualizer_rows = ground_truth.export_backup(conn, OUTPUT_FILE)
            generated_backup = json.loads(OUTPUT_FILE.read_text())
        except Exception as error:
            self.send_json(500, {"ok": False, "error": f"Delete failed: {error}"})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "deleted": {"tableName": table_name, "rowId": row_id},
                "visualizerExportId": visualizer_export_id,
                "visualizerRows": visualizer_rows,
                "backup": generated_backup,
            },
        )


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5175
    host = os.environ.get("TRACKER_API_HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), TrackerApiHandler)
    print(f"Workout Tracker listening on http://{host}:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
