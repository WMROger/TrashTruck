# Major Feature Status

Last reviewed: 2026-08-10

## Implemented and demonstrable

- Driver authentication uses Firebase email/password credentials and verifies that the signed-in Firestore profile has an active `driver` role.
- The driver route group independently blocks unauthenticated, disabled, and non-driver accounts.
- Historical waste forecasting uses the cleaned Danao City Block A monthly volume series.
- The forecasting service backtests seasonal-naive, linear-trend, and three-month moving-average baselines, then selects the lowest-MAE model and reports MAE, RMSE, and MAPE.
- Route dispatch uses report GPS coordinates, nearest-neighbor ordering, and a 2-opt improvement pass. Dispatch records store the method, straight-line distance estimate, and missing-coordinate count.
- Hotspot analytics groups unresolved geotagged reports into geographic cells and reports coverage and missing-GPS counts.
- When Google Routes API is enabled, dispatch uses road-aware waypoint optimization and stores the road polyline, driving distance, and duration for the driver’s in-app map. The geographic optimizer remains the automatic fallback.
- GPS report-density heat maps are now visible on both the CENRO web dashboard and native map view.
- CENRO can save an approved cost-per-ton and contingency assumption to produce a clearly labeled two-month budget planning scenario.

## Prototype or limited

- A real TensorFlow 2.21 LSTM candidate now exists in metric tons with a chronological train/validation/test split and five-seed evaluation. Its versioned artifact and forecast can be reviewed beside the production baseline in the dashboard. The ensemble beat seasonal-naive MAE by 5.53%, but only two of five individual seeds won, so it did not pass the stability gate.
- The production dashboard therefore continues to use the more stable planning baseline. Both approaches use one unidentified source block converted from cubic metres to estimated metric tons at 0.16 t/m³.
- Road-aware routing requires the Google Routes API to be enabled for the configured Maps key and may incur Google Maps Platform usage charges. Otherwise the app labels and uses the geographic fallback.
- Budget output remains a user-configured planning scenario until approved actual costs and expenditures are linked for backtesting.

## Not yet validated or production-ready

- Production TensorFlow inference, a model registry/version promotion process, and stable rolling-origin validation on a larger reconciled dataset.
- Official validated budget prediction. The planning calculator must be backtested after approved cost and expenditure records are linked.
- Field validation of geofenced proximity alerts under real background/mobile operating conditions.
- Formal reconciliation of the workbook's two unnamed blocks, mixed units, 2023 detail-versus-total differences, and 2025 anomalies.

## Defense wording

Describe the current forecasting feature as a **validated statistical baseline with a dashboard-visible TensorFlow LSTM candidate**, routing as **Google road-aware waypoint optimization with an automatic geographic fallback**, budget output as a **configurable planning scenario**, and hotspots as a **GPS report-density heat map**. Do not claim that the LSTM is promoted or that the budget scenario is an officially validated prediction.
