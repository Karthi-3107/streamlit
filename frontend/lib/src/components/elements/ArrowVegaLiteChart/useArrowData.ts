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

import { useEffect, useRef, useState } from "react"

import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import {
  dataIsAnAppendOfPrev,
  VegaLiteChartElement,
  WrappedNamedDataset,
} from "./arrowUtils"

export interface ArrowData {
  data: Quiver | null
  datasets: WrappedNamedDataset[]
}

enum ChangeState {
  NO_CHANGE,
  REMOVED,
  EXTENDED,
  ADDED,
  DIFFERENT_DATA,
}

function classifyDataChange(
  prevData: Quiver | null,
  data: Quiver | null
): ChangeState {
  if (!data || data.data.numRows === 0) {
    // The new data is empty, so we remove the dataset from the
    // chart view if the named dataset exists.
    return ChangeState.REMOVED
  }

  if (!prevData || prevData.data.numRows === 0) {
    // The previous data was empty, so we just insert the new data.
    return ChangeState.ADDED
  }

  const { dataRows: prevNumRows, dataColumns: prevNumCols } =
    prevData.dimensions
  const { dataRows: numRows, dataColumns: numCols } = data.dimensions

  // Check if dataframes have same "shape" but the new one has more rows.
  if (
    dataIsAnAppendOfPrev(
      prevData,
      prevNumRows,
      prevNumCols,
      data,
      numRows,
      numCols
    )
  ) {
    if (prevNumRows < numRows) {
      // Insert the new rows.
      return ChangeState.EXTENDED
    }

    return ChangeState.NO_CHANGE
  } else {
    return ChangeState.DIFFERENT_DATA
  }
}

// The goal of this function is to update the data and datasets state when
// we feel like the data has changed. The data is sent by reference, so we
// need to apply some heuristic to determine if the data has changed.
export function useArrowData(element: VegaLiteChartElement): ArrowData {
  // We use state to store the data and datasets, so that we can trigger
  // a render when we confirm that the data has changed.
  const [data, setData] = useState<Quiver | null>(null)
  const [datasets, setDatasets] = useState<WrappedNamedDataset[]>([])

  const prevData = useRef<Quiver | null>(null)
  const prevDatasets = useRef<WrappedNamedDataset[]>([])
  const { data: inputData, datasets: inputDatasets } = element

  useEffect(() => {
    if (
      classifyDataChange(prevData.current, inputData) !== ChangeState.NO_CHANGE
    ) {
      setData(inputData)
    }

    prevData.current = data
    prevDatasets.current = datasets
  }, [data, datasets])

  return { data, datasets }
}
