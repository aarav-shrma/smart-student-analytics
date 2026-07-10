Currently: End of Day 5, backend done. Frontend pending.

Backend state:
- Edge Function 'predict' deployed and tested
- 992 predictions across 8 courses (avg ~30% high risk, matches seeded distribution)
- predictions table populated with predicted_grade, risk_label, confidence, model_version

Next (Day 5 UI):
- Update useTeacherData.ts: add predictedGrade, riskLabel, confidence to StudentRow
- Add refreshPredictions() helper that invokes the Edge Function
- Add 'Refresh Predictions' button to TeacherDashboard
- Add 'Predicted' column to StudentRoster
- Add prediction card to StudentDashboard