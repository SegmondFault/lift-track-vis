import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  activePlan,
  BodyMetricEntry,
  exercises,
  exportWorkoutData,
  getOrCreateWorkoutSession,
  initialDays,
  insertBodyMetric,
  insertLoggedSet,
  loadBodyMetrics,
  loadAppSettings,
  loadLoggedSets,
  LoggedSet,
  makeId,
  muscleGroups,
  PlannedExercise,
  removeLoggedSet,
  saveWeekStartDay,
  saveUserSex,
  SessionBoundaryMode,
  setupDatabase,
  UserSex,
  WeekStartDay,
  WorkoutDay,
} from './src/storage';

type Screen = 'log' | 'days' | 'exercises' | 'settings';
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

const allSelectableLifts: PlannedExercise[] = exercises.map((exercise, index) => {
  const defaultVariation = exercise.variations.find((variation) => variation.isDefault) ?? exercise.variations[0];

  return {
    sourceName: exercise.name,
    exerciseId: exercise.id,
    variationId: defaultVariation.id,
    targetSets: 0,
    sortOrder: index + 1,
  };
});

function getExerciseName(exerciseId: string) {
  return exerciseById.get(exerciseId)?.name ?? exerciseId;
}

function getExerciseTags(exerciseId: string) {
  return exerciseById.get(exerciseId)?.tags?.join(', ') ?? 'untagged';
}

function getVariationName(exerciseId: string, variationId: string) {
  return exerciseById.get(exerciseId)?.variations.find((variation) => variation.id === variationId)?.name ?? 'Standard';
}

function getVariation(exerciseId: string, variationId: string) {
  return exerciseById.get(exerciseId)?.variations.find((variation) => variation.id === variationId);
}

function formatExactTimestamp(date: Date) {
  return date.toLocaleString([], {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  });
}

function getBoundaryStart(mode: SessionBoundaryMode) {
  const now = new Date();

  if (mode === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function liftKey(lift: Pick<PlannedExercise, 'exerciseId' | 'variationId'>) {
  return `${lift.exerciseId}:${lift.variationId}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('log');
  const [trainingDays, setTrainingDays] = useState<WorkoutDay[]>(initialDays);
  const [selectedDayIndex, setSelectedDayIndex] = useState(initialDays[0].dayIndex);
  const [isFreestyle, setIsFreestyle] = useState(false);
  const [showLiftPicker, setShowLiftPicker] = useState(false);
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [selectedLiftKey, setSelectedLiftKey] = useState(liftKey(initialDays[0].exercises[0]));
  const [sessionBoundaryMode, setSessionBoundaryMode] = useState<SessionBoundaryMode>('midnight');
  const [reps, setReps] = useState('8');
  const [weight, setWeight] = useState('55');
  const [bodyWeight, setBodyWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricEntry[]>([]);
  const [userSex, setUserSex] = useState<UserSex>('unspecified');
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>('monday');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateLoggedSets() {
      try {
        await setupDatabase();
        const persistedSets = await loadLoggedSets();
        const persistedBodyMetrics = await loadBodyMetrics();
        const persistedSettings = await loadAppSettings();

        if (isMounted) {
          setLoggedSets(persistedSets);
          setBodyMetrics(persistedBodyMetrics);
          setUserSex(persistedSettings.userSex);
          setWeekStartDay(persistedSettings.weekStartDay);
          setIsDatabaseReady(true);
        }
      } catch (error) {
        if (isMounted) {
          setDatabaseError(error instanceof Error ? error.message : 'Unknown database error');
          setIsDatabaseReady(true);
        }
      }
    }

    hydrateLoggedSets();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedDay = trainingDays.find((day) => day.dayIndex === selectedDayIndex) ?? trainingDays[0];
  const boundaryStart = getBoundaryStart(sessionBoundaryMode);
  const actualSets = loggedSets.filter((set) => set.loggedAt >= boundaryStart);

  const actualLifts = useMemo(() => {
    const seen = new Map<string, PlannedExercise & { firstLoggedAt: Date; setCount: number }>();

    for (const set of actualSets) {
      const key = liftKey(set);
      const existing = seen.get(key);

      if (existing) {
        existing.setCount += 1;
        continue;
      }

      seen.set(key, {
        sourceName: getExerciseName(set.exerciseId),
        exerciseId: set.exerciseId,
        variationId: set.variationId,
        targetSets: 0,
        sortOrder: seen.size + 1,
        firstLoggedAt: set.loggedAt,
        setCount: 1,
      });
    }

    return [...seen.values()].sort((a, b) => a.firstLoggedAt.getTime() - b.firstLoggedAt.getTime());
  }, [actualSets]);

  const selectedLift =
    actualLifts.find((lift) => liftKey(lift) === selectedLiftKey) ??
    selectedDay.exercises.find((lift) => liftKey(lift) === selectedLiftKey) ??
    allSelectableLifts.find((lift) => liftKey(lift) === selectedLiftKey) ??
    selectedDay.exercises[0];

  const recentSets = [...actualSets].sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime()).slice(0, 10);

  function selectDay(day: WorkoutDay) {
    setIsFreestyle(false);
    setSelectedDayIndex(day.dayIndex);
    setShowLiftPicker(false);
  }

  function addTrainingDay() {
    setTrainingDays((currentDays) => {
      const nextIndex = currentDays.length + 1;
      const newDay: WorkoutDay = {
        id: `custom-day-${nextIndex}`,
        dayIndex: nextIndex,
        name: `Day ${nextIndex}`,
        exercises: [],
      };

      setSelectedDayIndex(nextIndex);
      return [...currentDays, newDay];
    });
  }

  function removeLastTrainingDay() {
    setTrainingDays((currentDays) => {
      if (currentDays.length <= 1) {
        return currentDays;
      }

      const nextDays = currentDays.slice(0, -1);
      const removedDay = currentDays[currentDays.length - 1];

      if (selectedDayIndex === removedDay.dayIndex) {
        setSelectedDayIndex(nextDays[nextDays.length - 1].dayIndex);
      }

      return nextDays;
    });
  }

  function startFreestyle() {
    setIsFreestyle(true);
    setShowLiftPicker(true);
  }

  function selectLift(lift: PlannedExercise) {
    setSelectedLiftKey(liftKey(lift));
    setShowLiftPicker(false);
  }

  function countActualSetsFor(lift: Pick<PlannedExercise, 'exerciseId' | 'variationId'>) {
    return actualSets.filter((set) => set.exerciseId === lift.exerciseId && set.variationId === lift.variationId).length;
  }

  function isPlannedLiftStarted(lift: PlannedExercise) {
    return actualLifts.some((actualLift) => liftKey(actualLift) === liftKey(lift));
  }

  function moveActualLift(key: string, direction: -1 | 1) {
    const current = actualLifts.find((lift) => liftKey(lift) === key);
    const index = actualLifts.findIndex((lift) => liftKey(lift) === key);
    const target = actualLifts[index + direction];

    if (!current || !target) {
      return;
    }

    const currentTime = current.firstLoggedAt;
    const targetTime = target.firstLoggedAt;

    setLoggedSets((sets) =>
      sets.map((set) => {
        if (set.exerciseId === current.exerciseId && set.variationId === current.variationId) {
          return { ...set, loggedAt: targetTime };
        }

        if (set.exerciseId === target.exerciseId && set.variationId === target.variationId) {
          return { ...set, loggedAt: currentTime };
        }

        return set;
      }),
    );
  }

  async function logSet() {
    const parsedReps = Number.parseInt(reps, 10);
    const parsedWeight = Number.parseFloat(weight);

    if (!Number.isFinite(parsedReps) || parsedReps <= 0 || !Number.isFinite(parsedWeight)) {
      return;
    }

    try {
      const workoutSessionId = await getOrCreateWorkoutSession({
        boundaryStart,
        dayIndex: isFreestyle ? null : selectedDay.dayIndex,
        isFreestyle,
      });
      const newSet: LoggedSet = {
        id: makeId('set'),
        workoutSessionId,
        dayIndex: isFreestyle ? null : selectedDay.dayIndex,
        exerciseId: selectedLift.exerciseId,
        variationId: selectedLift.variationId,
        reps: parsedReps,
        weight: parsedWeight,
        loggedAt: new Date(),
      };

      setLoggedSets((sets) => [...sets, newSet]);
      await insertLoggedSet(newSet);
      setSelectedLiftKey(liftKey(selectedLift));
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Failed to save set');
    }
  }

  function deleteSet(setId: string) {
    setLoggedSets((sets) => sets.filter((set) => set.id !== setId));
    removeLoggedSet(setId).catch((error) => {
      setDatabaseError(error instanceof Error ? error.message : 'Failed to delete set');
    });
  }

  async function saveBodyMetric() {
    const parsedBodyWeight = bodyWeight.trim() ? Number.parseFloat(bodyWeight) : null;
    const parsedBodyFat = bodyFat.trim() ? Number.parseFloat(bodyFat) : null;

    if (
      (parsedBodyWeight !== null && !Number.isFinite(parsedBodyWeight)) ||
      (parsedBodyFat !== null && !Number.isFinite(parsedBodyFat)) ||
      (parsedBodyWeight === null && parsedBodyFat === null)
    ) {
      return;
    }

    const entry: BodyMetricEntry = {
      id: makeId('body'),
      measuredAt: new Date(),
      bodyWeight: parsedBodyWeight,
      bodyFat: parsedBodyFat,
      source: 'manual',
    };

    try {
      await insertBodyMetric(entry);
      setBodyMetrics((current) => [entry, ...current].slice(0, 20));
      setBodyWeight('');
      setBodyFat('');
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Failed to save body metric');
    }
  }

  async function chooseUserSex(nextSex: UserSex) {
    setUserSex(nextSex);

    try {
      await saveUserSex(nextSex);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Failed to save sex setting');
    }
  }

  async function chooseWeekStartDay(nextWeekStartDay: WeekStartDay) {
    setWeekStartDay(nextWeekStartDay);

    try {
      await saveWeekStartDay(nextWeekStartDay);
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : 'Failed to save week start setting');
    }
  }

  async function exportData() {
    try {
      setExportStatus('Preparing export...');
      const result = await exportWorkoutData();
      setExportStatus(`Export ready: ${result.jsonPath.split('/').pop()}`);
    } catch (error) {
      setExportStatus(null);
      setDatabaseError(error instanceof Error ? error.message : 'Failed to export data');
    }
  }

  function renderLogScreen() {
    return (
      <>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{isFreestyle ? 'Mode' : 'Workout'}</Text>
            <Text style={styles.title}>{isFreestyle ? 'Freestyle' : selectedDay.name}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryText}>{actualSets.length} sets</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Plan</Text>
          <Text style={styles.panelTitle}>{activePlan.name}</Text>
          <Text style={styles.muted}>Targets guide the session. Logged sets are the actual record.</Text>
          <Text style={styles.persistenceText}>
            {databaseError
              ? `Storage issue: ${databaseError}`
              : isDatabaseReady
                ? 'Local SQLite storage ready'
                : 'Loading local storage...'}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller}>
            {trainingDays.map((day) => (
              <TouchableOpacity
                key={day.id}
                onPress={() => selectDay(day)}
                style={[
                  styles.dayButton,
                  !isFreestyle && selectedDay.dayIndex === day.dayIndex && styles.dayButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    !isFreestyle && selectedDay.dayIndex === day.dayIndex && styles.dayButtonTextSelected,
                  ]}
                >
                  {day.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => selectDay(selectedDay)} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Planned</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={startFreestyle} style={[styles.secondaryButton, isFreestyle && styles.modeOn]}>
              <Text style={[styles.secondaryButtonText, isFreestyle && styles.modeOnText]}>Freestyle</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Plan Targets</Text>
          <TouchableOpacity onPress={() => setShowLiftPicker((visible) => !visible)} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>{showLiftPicker ? 'Close' : 'Any exercise'}</Text>
          </TouchableOpacity>
        </View>

        {showLiftPicker ? (
          <View style={styles.pickerPanel}>
            <Text style={styles.eyebrow}>Select any exercise</Text>
            {allSelectableLifts.map((lift) => (
              <TouchableOpacity
                key={`${lift.exerciseId}-${lift.variationId}`}
                onPress={() => selectLift(lift)}
                style={styles.pickerRow}
              >
                <View>
                  <Text style={styles.exerciseName}>{getExerciseName(lift.exerciseId)}</Text>
                  <Text style={styles.exerciseMeta}>
                    {getVariationName(lift.exerciseId, lift.variationId)} / {getExerciseTags(lift.exerciseId)}
                  </Text>
                </View>
                <Text style={styles.addText}>Use</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.exerciseList}>
          {selectedDay.exercises.map((lift) => {
            const isStarted = isPlannedLiftStarted(lift);

            return (
              <TouchableOpacity
                key={`${lift.exerciseId}-${lift.variationId}-${lift.sortOrder}`}
                onPress={() => selectLift(lift)}
                style={[styles.exerciseRow, styles.plannedRow, isStarted && styles.plannedRowStarted]}
              >
                <View style={styles.exerciseCopy}>
                  <Text style={styles.exerciseName}>{getExerciseName(lift.exerciseId)}</Text>
                  <Text style={styles.exerciseMeta}>
                    {getVariationName(lift.exerciseId, lift.variationId)} / target {lift.targetSets} sets
                  </Text>
                  <Text style={styles.targetStatus}>{isStarted ? 'Seen in actual session' : 'Not started'}</Text>
                </View>
                <View style={styles.countBubble}>
                  <Text style={styles.countText}>{countActualSetsFor(lift)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.entryPanel}>
          <Text style={styles.eyebrow}>Now</Text>
          <Text style={styles.activeLift}>{getExerciseName(selectedLift.exerciseId)}</Text>
          <Text style={styles.muted}>{getVariationName(selectedLift.exerciseId, selectedLift.variationId)}</Text>

          <View style={styles.inputGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setReps}
                selectTextOnFocus
                style={styles.input}
                value={reps}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setWeight}
                selectTextOnFocus
                style={styles.input}
                value={weight}
              />
            </View>
          </View>

          <TouchableOpacity onPress={logSet} style={styles.logButton}>
            <Text style={styles.logButtonText}>Log set</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <View style={styles.sectionHeaderTight}>
            <View>
              <Text style={styles.eyebrow}>Bodyweight</Text>
              <Text style={styles.muted}>Optional, used for normalized strength.</Text>
            </View>
            {bodyMetrics[0]?.bodyWeight ? <Text style={styles.helperText}>{bodyMetrics[0].bodyWeight} kg latest</Text> : null}
          </View>
          <View style={styles.quickWeightRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setBodyWeight}
              placeholder="kg"
              selectTextOnFocus
              style={[styles.input, styles.quickWeightInput]}
              value={bodyWeight}
            />
            <TouchableOpacity onPress={saveBodyMetric} style={styles.quickWeightButton}>
              <Text style={styles.primaryButtonText}>Log weight</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actual Session</Text>
          <Text style={styles.helperText}>{sessionBoundaryMode === 'midnight' ? 'Since midnight' : 'Last 24 hours'}</Text>
        </View>

        <View style={styles.exerciseList}>
          {actualLifts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.muted}>No actual exercises yet. Log a set to start the session truth.</Text>
            </View>
          ) : (
            actualLifts.map((lift, index) => {
              const key = liftKey(lift);
              const isSelected = key === liftKey(selectedLift);

              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => selectLift(lift)}
                  style={[styles.exerciseRow, isSelected && styles.exerciseRowSelected]}
                >
                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{getExerciseName(lift.exerciseId)}</Text>
                    <Text style={styles.exerciseMeta}>
                      {getVariationName(lift.exerciseId, lift.variationId)} / {lift.setCount} sets
                    </Text>
                  </View>
                  <View style={styles.reorderControls}>
                    <TouchableOpacity
                      disabled={index === 0}
                      onPress={() => moveActualLift(key, -1)}
                      style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                    >
                      <Text style={styles.reorderText}>Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={index === actualLifts.length - 1}
                      onPress={() => moveActualLift(key, 1)}
                      style={[styles.reorderButton, index === actualLifts.length - 1 && styles.reorderButtonDisabled]}
                    >
                      <Text style={styles.reorderText}>Down</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.setList}>
          <Text style={styles.eyebrow}>Last sets</Text>
          {recentSets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.muted}>No sets in the current actual-session window.</Text>
            </View>
          ) : (
            recentSets.map((set) => (
              <View key={set.id} style={styles.setRow}>
                <View style={styles.setCopy}>
                  <Text style={styles.setText}>
                    {getExerciseName(set.exerciseId)}: {set.reps} x {set.weight} kg
                  </Text>
                  <Text style={styles.muted}>{getVariationName(set.exerciseId, set.variationId)}</Text>
                  <Text style={styles.timestampText}>{formatExactTimestamp(set.loggedAt)}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteSet(set.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </>
    );
  }

  function renderDaysScreen() {
    return (
      <>
        <Text style={styles.title}>Training Days</Text>
        <Text style={styles.pageIntro}>Design the plan here. Logging remains separate from these targets.</Text>
        <View style={styles.panel}>
          <Text style={styles.eyebrow}>Plan length</Text>
          <Text style={styles.panelTitle}>{trainingDays.length} training days</Text>
          <Text style={styles.muted}>Change how many days are in the repeating plan.</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={addTrainingDay} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Add day</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={removeLastTrainingDay} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Remove last</Text>
            </TouchableOpacity>
          </View>
        </View>

        {trainingDays.map((day) => (
          <View key={day.id} style={styles.panel}>
            <View style={styles.sectionHeaderTight}>
              <Text style={styles.panelTitle}>{day.name}</Text>
              <TouchableOpacity style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {day.exercises.map((lift) => (
              <View key={`${day.id}-${lift.exerciseId}-${lift.variationId}`} style={styles.compactRow}>
                <Text style={styles.compactTitle}>{getExerciseName(lift.exerciseId)}</Text>
                <Text style={styles.muted}>
                  {getVariationName(lift.exerciseId, lift.variationId)} / {lift.targetSets} sets
                </Text>
              </View>
            ))}
            {day.exercises.length === 0 ? (
              <View style={styles.compactRow}>
                <Text style={styles.muted}>No targets yet.</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.secondaryFullButton}>
              <Text style={styles.secondaryButtonText}>Add target</Text>
            </TouchableOpacity>
          </View>
        ))}
      </>
    );
  }

  function renderExercisesScreen() {
    return (
      <>
        <Text style={styles.title}>Exercises</Text>
        <Text style={styles.pageIntro}>Add/remove exercises, variations, and muscle coefficients here.</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>New exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>New variation</Text>
          </TouchableOpacity>
        </View>
        {exercises.slice(0, 12).map((exercise) => {
          const defaultVariation = exercise.variations.find((variation) => variation.isDefault) ?? exercise.variations[0];
          const contributions = defaultVariation?.muscleContributions?.slice(0, 3) ?? [];

          return (
            <View key={exercise.id} style={styles.exerciseAdminRow}>
              <View style={styles.exerciseCopy}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {(exercise.tags ?? ['untagged']).join(', ')} / {exercise.variations.length} variations /{' '}
                  {contributions.length} visible coefficients
                </Text>
                <Text style={styles.targetStatus}>
                  {contributions.map((item) => `${item.muscleGroupId} ${item.coefficient}`).join(', ')}
                </Text>
              </View>
              <TouchableOpacity style={styles.smallButton}>
                <Text style={styles.smallButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </>
    );
  }

  function renderSettingsScreen() {
    return (
      <>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.pageIntro}>Global behavior that should not clutter the gym logging screen.</Text>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Actual Session Window</Text>
          <Text style={styles.muted}>Controls how the Actual Session list is rebuilt from logged sets.</Text>
          <View style={styles.segmented}>
            <TouchableOpacity
              onPress={() => setSessionBoundaryMode('midnight')}
              style={[styles.segment, sessionBoundaryMode === 'midnight' && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, sessionBoundaryMode === 'midnight' && styles.segmentTextSelected]}>
                Since midnight
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSessionBoundaryMode('24h')}
              style={[styles.segment, sessionBoundaryMode === '24h' && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, sessionBoundaryMode === '24h' && styles.segmentTextSelected]}>
                Last 24 hours
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Seed Data</Text>
          <Text style={styles.muted}>
            {exercises.length} exercises / {muscleGroups.length} muscle groups / {trainingDays.length} training days
          </Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>External Norm Category</Text>
          <Text style={styles.muted}>Used only for strength-standard comparisons in analytics exports.</Text>
          <View style={styles.segmented}>
            {(['unspecified', 'male', 'female'] as UserSex[]).map((sex) => (
              <TouchableOpacity
                key={sex}
                onPress={() => chooseUserSex(sex)}
                style={[styles.segment, userSex === sex && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, userSex === sex && styles.segmentTextSelected]}>
                  {sex === 'unspecified' ? 'Unset' : sex}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Analytics Week</Text>
          <Text style={styles.muted}>Controls weekly plan and trend buckets in exports and the Mac visualizer.</Text>
          <View style={styles.segmented}>
            {(['monday', 'sunday'] as WeekStartDay[]).map((day) => (
              <TouchableOpacity
                key={day}
                onPress={() => chooseWeekStartDay(day)}
                style={[styles.segment, weekStartDay === day && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, weekStartDay === day && styles.segmentTextSelected]}>
                  {day === 'monday' ? 'Monday' : 'Sunday'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Body Metrics</Text>
          <Text style={styles.muted}>Backfill these whenever needed. Analytics joins lifts to the nearest prior entry.</Text>
          <View style={styles.inputGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bodyweight</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setBodyWeight}
                placeholder="kg"
                selectTextOnFocus
                style={styles.input}
                value={bodyWeight}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Body fat</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setBodyFat}
                placeholder="%"
                selectTextOnFocus
                style={styles.input}
                value={bodyFat}
              />
            </View>
          </View>
          <TouchableOpacity onPress={saveBodyMetric} style={styles.secondaryFullButton}>
            <Text style={styles.secondaryButtonText}>Save body metric</Text>
          </TouchableOpacity>
          {bodyMetrics.slice(0, 3).map((entry) => (
            <View key={entry.id} style={styles.compactRow}>
              <Text style={styles.compactTitle}>{formatExactTimestamp(entry.measuredAt)}</Text>
              <Text style={styles.muted}>
                {entry.bodyWeight ? `${entry.bodyWeight} kg` : 'weight skipped'}
                {entry.bodyFat ? ` / ${entry.bodyFat}%` : ''}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Export To Mac</Text>
          <Text style={styles.muted}>Creates a read-only JSON backup for the local Mac visualizer.</Text>
          <TouchableOpacity onPress={exportData} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Export backup</Text>
          </TouchableOpacity>
          {exportStatus ? <Text style={styles.persistenceText}>{exportStatus}</Text> : null}
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {screen === 'log' ? renderLogScreen() : null}
        {screen === 'days' ? renderDaysScreen() : null}
        {screen === 'exercises' ? renderExercisesScreen() : null}
        {screen === 'settings' ? renderSettingsScreen() : null}
      </ScrollView>
      <View style={styles.tabBar}>
        {[
          ['log', 'Log'],
          ['days', 'Days'],
          ['exercises', 'Exercises'],
          ['settings', 'Settings'],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setScreen(key as Screen)}
            style={[styles.tabButton, screen === key && styles.tabButtonSelected]}
          >
            <Text style={[styles.tabText, screen === key && styles.tabTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    padding: 18,
    paddingBottom: 110,
    backgroundColor: '#ffffff',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#6d7077',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#171717',
    fontSize: 34,
    fontWeight: '900',
  },
  pageIntro: {
    color: '#6d7077',
    fontSize: 15,
    marginBottom: 16,
    marginTop: 6,
  },
  summaryPill: {
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryText: {
    color: '#171717',
    fontWeight: '800',
  },
  panel: {
    backgroundColor: '#f5f6f8',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  panelTitle: {
    color: '#171717',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  muted: {
    color: '#6d7077',
    marginTop: 3,
  },
  persistenceText: {
    color: '#147a5f',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  dayScroller: {
    marginTop: 14,
  },
  dayButton: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayButtonSelected: {
    backgroundColor: '#147a5f',
    borderColor: '#147a5f',
  },
  dayButtonText: {
    color: '#171717',
    fontWeight: '900',
  },
  dayButtonTextSelected: {
    color: '#ffffff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    backgroundColor: '#246bfe',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondaryFullButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: '#171717',
    fontWeight: '900',
  },
  modeOn: {
    backgroundColor: '#eef8f5',
    borderColor: '#147a5f',
  },
  modeOnText: {
    color: '#147a5f',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  sectionHeaderTight: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#171717',
    fontSize: 22,
    fontWeight: '900',
  },
  smallButton: {
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallButtonText: {
    color: '#171717',
    fontSize: 15,
    fontWeight: '700',
  },
  pickerPanel: {
    backgroundColor: '#f5f6f8',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  pickerRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    padding: 12,
  },
  addText: {
    color: '#246bfe',
    fontWeight: '900',
  },
  exerciseList: {
    gap: 10,
    marginTop: 12,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 78,
    padding: 14,
  },
  exerciseRowSelected: {
    backgroundColor: '#eef8f5',
    borderColor: '#147a5f',
  },
  plannedRow: {
    backgroundColor: '#f5f6f8',
    borderColor: '#d7dbe2',
    opacity: 0.78,
  },
  plannedRowStarted: {
    opacity: 0.45,
  },
  exerciseCopy: {
    flex: 1,
    paddingRight: 12,
  },
  exerciseName: {
    color: '#171717',
    fontSize: 18,
    fontWeight: '900',
  },
  exerciseMeta: {
    color: '#6d7077',
    marginTop: 4,
  },
  targetStatus: {
    color: '#6d7077',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  countBubble: {
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  countText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  helperText: {
    color: '#6d7077',
    fontSize: 12,
    fontWeight: '700',
  },
  reorderControls: {
    gap: 6,
  },
  reorderButton: {
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  reorderButtonDisabled: {
    opacity: 0.35,
  },
  reorderText: {
    color: '#171717',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  entryPanel: {
    backgroundColor: '#f5f6f8',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
  },
  activeLift: {
    color: '#171717',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#171717',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    color: '#171717',
    fontSize: 24,
    fontWeight: '900',
    minHeight: 62,
    paddingHorizontal: 12,
  },
  quickWeightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  quickWeightInput: {
    flex: 1,
  },
  quickWeightButton: {
    alignItems: 'center',
    backgroundColor: '#246bfe',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: 14,
  },
  logButton: {
    alignItems: 'center',
    backgroundColor: '#246bfe',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 62,
  },
  logButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  setList: {
    gap: 8,
    marginTop: 12,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  setRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  setCopy: {
    flex: 1,
  },
  setText: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '900',
  },
  timestampText: {
    color: '#171717',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  deleteButton: {
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  deleteText: {
    color: '#b83232',
    fontWeight: '800',
  },
  compactRow: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 10,
  },
  compactTitle: {
    color: '#171717',
    fontWeight: '900',
  },
  exerciseAdminRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    padding: 12,
  },
  segmented: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 14,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingVertical: 10,
  },
  segmentSelected: {
    backgroundColor: '#147a5f',
  },
  segmentText: {
    color: '#171717',
    fontWeight: '900',
  },
  segmentTextSelected: {
    color: '#ffffff',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderColor: '#d7dbe2',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 18,
    flexDirection: 'row',
    gap: 6,
    left: 18,
    padding: 6,
    position: 'absolute',
    right: 18,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
  },
  tabButtonSelected: {
    backgroundColor: '#eef8f5',
  },
  tabText: {
    color: '#171717',
    fontSize: 12,
    fontWeight: '900',
  },
  tabTextSelected: {
    color: '#147a5f',
  },
});
