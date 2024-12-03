/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Streamlit Performance Metric names. Allows this to be type-safe for our
 * purposes.
 */
export type StPerformanceMetric = "script-run-cycle"

/**
 * Streamlit Performance Mark names. Allows this to be type-safe for our
 * purposes.
 */
export type StPerformanceMark =
  | "running"
  | "notRunning"
  | "rerunRequested"
  | "stopRequested"
  | "compilationError"
