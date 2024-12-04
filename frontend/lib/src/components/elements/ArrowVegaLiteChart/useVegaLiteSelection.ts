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

import { useCallback, useMemo } from "react"

import { SignalValue, View as VegaView } from "vega"
import isEqual from "lodash/isEqual"

import {
  WidgetInfo,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import { debounce, notNullOrUndefined } from "@streamlit/lib/src/util/utils"
import { useFormClearHelper } from "@streamlit/lib/src/components/widgets/Form"

import { VegaLiteChartElement } from "./arrowUtils"

/**
 * Debounce time for triggering a widget state update
 * This prevents to rapid updates to the widget state.
 */
const DEBOUNCE_TIME_MS = 150

/** This is the state that is sent to the backend
 * This needs to be the same structure that is also defined
 * in the Python code.
 */
export interface VegaLiteState {
  selection: Record<string, any>
}

export const useVegaLiteSelections = (
  element: VegaLiteChartElement,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): ((view: VegaView | null) => void) => {
  const { id: chartId, selectionMode: inputSelectionMode, formId } = element
  const selectionMode = useMemo(() => {
    return inputSelectionMode as string[]
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(element.selectionMode)])

  const maybeConfigureSelections = useCallback(
    (vegaView: VegaView | null): void => {
      // Add listeners for all selection events. Find out more here:
      // https://vega.github.io/vega/docs/api/view/#view_addSignalListener
      selectionMode.forEach((param, _index) => {
        vegaView?.addSignalListener(
          param,
          debounce(DEBOUNCE_TIME_MS, (name: string, value: SignalValue) => {
            // Store the current chart selection state with the widget manager so that it
            // can be used for restoring the state when the component unmounted and
            // created again. This can happen when elements are added before it within
            // the delta path. The viewState is only stored in the frontend, and not
            // synced to the backend.
            const viewState = vegaView?.getState({
              // There are also `signals` data, but I believe its
              // not relevant for restoring the selection state.
              data: (name?: string, _operator?: any) => {
                // Vega lite stores the selection state in a <param name>_store parameter
                // under `data` that can be retrieved via the getState method.
                // https://vega.github.io/vega/docs/api/view/#view_getState
                return selectionMode.some(mode => `${mode}_store` === name)
              },
              // Don't include subcontext data since it will lead to exceptions
              // when loading the state.
              recurse: false,
            })

            if (notNullOrUndefined(viewState)) {
              widgetMgr.setElementState(chartId, "viewState", viewState)
            }

            // If selection encodings are correctly specified, vega-lite will return
            // a list of selected points within the vlPoint.or property:
            // https://github.com/vega/altair/blob/f1b4e2c84da2fba220022c8a285cc8280f824ed8/altair/utils/selection.py#L50
            // We want to just return this list of points instead of the entire object
            // since the other parts of the selection object are not useful.
            let processedSelection = value
            if ("vlPoint" in value && "or" in value.vlPoint) {
              processedSelection = value.vlPoint.or
            }

            const widgetInfo: WidgetInfo = { id: chartId, formId }

            // Get the current widget state
            const currentWidgetState = JSON.parse(
              widgetMgr.getStringValue(widgetInfo) || "{}"
            )

            // Update the component-internal selection state
            const updatedSelections = {
              selection: {
                ...(currentWidgetState?.selection || {}),
                [name]: processedSelection || {},
              } as VegaLiteState,
            }

            // Update the widget state if the selection state has changed
            // compared to the last update. This selection state will be synced
            // with the backend.
            if (!isEqual(currentWidgetState, updatedSelections)) {
              widgetMgr.setStringValue(
                widgetInfo,
                JSON.stringify(updatedSelections),
                {
                  fromUi: true,
                },
                fragmentId
              )
            }
          })
        )
      })
    },
    [chartId, selectionMode, widgetMgr, formId, fragmentId]
  )

  const onFormCleared = useCallback(() => {
    const emptySelectionState: VegaLiteState = {
      selection: {},
    }
    // Initialize all parameters defined in the selectionMode with an empty object.
    selectionMode.forEach(param => {
      emptySelectionState.selection[param] = {}
    })
    const widgetInfo = { id: chartId, formId }
    const currentWidgetStateStr = widgetMgr.getStringValue(widgetInfo)
    const currentWidgetState = currentWidgetStateStr
      ? JSON.parse(currentWidgetStateStr)
      : // If there wasn't any selection yet, the selection state
        // is assumed to be empty.
        emptySelectionState

    if (!isEqual(currentWidgetState, emptySelectionState)) {
      widgetMgr.setStringValue(
        widgetInfo,
        JSON.stringify(emptySelectionState),
        {
          fromUi: true,
        },
        fragmentId
      )
    }
  }, [chartId, formId, fragmentId, selectionMode, widgetMgr])

  useFormClearHelper({ widgetMgr, element, onFormCleared })

  return maybeConfigureSelections
}
