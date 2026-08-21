# Mobile Exercise Tracker

It seems fairly apparent that everyone should build their own exercise tracker, for ...reasons. 

In any case, this one is setup around resistance training, and utilises tailscale and an always on server. 

The core concept is: 

* Note your lifts on phone your phone at the gym
* Log biometric data on main machine
* Setup plans for easy click through and to check adherence
* Check back on the tracker/visualiser for longitudinal analysis

This way you, and only you, can track your exercise, presuming you've got an always (or mostly) on machine, and a tailscale account -which is free.

## Start the phone app and visualizer

From this folder, run:

```sh
./scripts/start-tracker.sh
```

(I use an alias but you can set that up youreslf
