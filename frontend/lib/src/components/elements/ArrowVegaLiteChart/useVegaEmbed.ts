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

import { RefObject, useCallback, useEffect, useRef, useState } from "react"

import { truthy, View as VegaView } from "vega"
import embed from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"

import { WidgetStateManager } from "@streamlit/lib"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"
import { logMessage } from "@streamlit/lib/src/util/log"

import {
  dataIsAnAppendOfPrev,
  getDataArray,
  getDataArrays,
  getDataSets,
  getInlineData,
  VegaLiteChartElement,
} from "./arrowUtils"

const DEFAULT_DATA_NAME = "source"

interface UseVegaEmbedOutput {
  error: Error | null
  vegaView: VegaView | null
  createView: (spec: any) => Promise<void>
  finalizeView: () => void
}

export function useVegaEmbed(
  containerRef: RefObject<HTMLDivElement>,
  element: VegaLiteChartElement
): UseVegaEmbedOutput {
  const vegaView = useRef<VegaView | null>(null)
  const vegaFinalizer = useRef<(() => void) | null>(null)
  const defaultDataName = useRef<string>(DEFAULT_DATA_NAME)
  const [error, setError] = useState<Error | null>(null)

  const { data, datasets } = element
  const finalizeView = useCallback(() => {
    if (vegaFinalizer.current) {
      vegaFinalizer.current()
    }

    vegaFinalizer.current = null
    vegaView.current = null
  }, [])

  const createView = useCallback(
    async (spec: any, widgetMgr: WidgetStateManager): Promise<void> => {
      try {
        logMessage("Creating a new Vega view.")

        if (!containerRef.current) {
          throw new Error("Element missing.")
        }

        // Finalize the previous view so it can be garbage collected.
        finalizeView()

        const options = {
          // Adds interpreter support for Vega expressions that is compliant with CSP
          ast: true,
          expr: expressionInterpreter,

          // Disable default styles so that vega doesn't inject <style> tags in the
          // DOM. We set these styles manually for finer control over them and to
          // avoid inlining styles.
          tooltip: { disableDefaultStyle: true },
          defaultStyle: false,
          forceActionsMenu: true,
        }

        const { vgSpec, view, finalize } = await embed(
          containerRef.current,
          spec,
          options
        )

        vegaView.current = view

        // TODO: implement maybeConfigureSelections
        // Try to load the previous state of the chart from the element state.
        // This is useful to restore the selection state when the component is re-mounted
        // or when its put into fullscreen mode.
        const viewState = widgetMgr.getElementState(
          chartId,
          "viewState"
        )(chartId)
        if (notNullOrUndefined(viewState)) {
          try {
            vegaView.current = vegaView.current.setState(viewState)
          } catch (e) {
            logWarning("Failed to restore view state", e)
          }
        }

        vegaFinalizer.current = finalize

        const dataArrays = getDataArrays(datasets ?? [])

        // Heuristic to determine the default dataset name.
        const datasetNames = dataArrays ? Object.keys(dataArrays) : []
        if (datasetNames.length === 1) {
          const [datasetName] = datasetNames
          defaultDataName.current = datasetName
        } else if (datasetNames.length === 0 && vgSpec.data) {
          defaultDataName.current = DEFAULT_DATA_NAME
        }

        const dataObj = getInlineData(data)
        if (dataObj) {
          view.insert(defaultDataName.current, dataObj)
        }
        if (dataArrays) {
          for (const [name, data] of Object.entries(dataArrays)) {
            view.insert(name, data)
          }
        }

        await view.runAsync()

        // Fix bug where the "..." menu button overlaps with charts where width is
        // set to -1 on first load.
        vegaView.current.resize().runAsync()
        vegaView.current = view
      } catch (e) {
        setError(ensureError(e))
      }
    },
    [containerRef, finalizeView, datasets, data]
  )

  const prevElement = useRef<VegaLiteChartElement | null>(null)

  const updateData = useCallback(
    (name: string, prevData: Quiver | null, data: Quiver | null): void => {
      if (!vegaView.current) {
        return
      }

      if (!data || data.data.numRows === 0) {
        // The new data is empty, so we remove the dataset from the
        // chart view if the named dataset exists.
        try {
          vegaView.current.remove(name, truthy)
        } finally {
          return
        }
      }

      if (!prevData || prevData.data.numRows === 0) {
        // The previous data was empty, so we just insert the new data.
        vegaView.current.insert(name, getDataArray(data))
        return
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
          vegaView.current.insert(name, getDataArray(data, prevNumRows))
        }
      } else {
        // Clean the dataset and insert from scratch.
        vegaView.current.data(name, getDataArray(data))
        logMessage(
          `Had to clear the ${name} dataset before inserting data through Vega view.`
        )
      }
    },
    []
  )

  useEffect(() => {
    if (prevElement.current || data) {
      updateData(
        defaultDataName.current,
        prevElement.current?.data ?? null,
        data
      )
    }

    const prevDataSets = getDataSets(prevElement.current?.datasets ?? []) ?? {}
    const dataSets = getDataSets(datasets) ?? {}

    for (const [name, dataset] of Object.entries(dataSets)) {
      const datasetName = name || defaultDataName.current
      const prevDataset = prevDataSets[datasetName]

      updateData(datasetName, prevDataset, dataset)
    }

    // Remove all datasets that are in the previous but not the current datasets.
    for (const name of Object.keys(prevDataSets)) {
      if (!dataSets.hasOwnProperty(name) && name !== defaultDataName.current) {
        updateData(name, null, null)
      }
    }

    vegaView.current?.resize().runAsync()
    prevElement.current = element
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.data, updateData])

  return { error, vegaView: vegaView.current, createView, finalizeView }
}
