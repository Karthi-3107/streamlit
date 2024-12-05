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

import React, {
  FC,
  ProfilerOnRenderCallback,
  PropsWithChildren,
  Profiler as ReactProfiler,
  useCallback,
} from "react"

import { CircularBuffer } from "@streamlit/lib"

export type ProfilerProps = PropsWithChildren<{
  id: string
}>

export const Profiler: FC<ProfilerProps> = ({ id, children }) => {
  const handleRender = useCallback<ProfilerOnRenderCallback>(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      window.__streamlit_profiles__ = window.__streamlit_profiles__ || {}

      window.__streamlit_profiles__[id] =
        window.__streamlit_profiles__[id] || new CircularBuffer(1000)

      window.__streamlit_profiles__[id].push({
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      })
    },
    []
  )

  return (
    <ReactProfiler id={id} onRender={handleRender}>
      {children}
    </ReactProfiler>
  )
}
