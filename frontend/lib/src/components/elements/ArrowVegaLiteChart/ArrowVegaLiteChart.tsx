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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Global, useTheme } from "@emotion/react"
import embed from "vega-embed"
import * as vega from "vega"
import { SignalValue } from "vega"
import { expressionInterpreter } from "vega-interpreter"
import isEqual from "lodash/isEqual"

import {
  debounce,
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"
import {
  WidgetInfo,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
import { logMessage, logWarning } from "@streamlit/lib/src/util/log"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
import { EmotionTheme } from "@streamlit/lib/src/theme"
import { useFormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import Toolbar, {
  StyledToolbarElementContainer,
} from "@streamlit/lib/src/components/shared/Toolbar"
import { ElementFullscreenContext } from "@streamlit/lib/src/components/shared/ElementFullscreen/ElementFullscreenContext"
import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"

import {
  dataIsAnAppendOfPrev,
  getDataArray,
  getDataArrays,
  getDataSets,
  getInlineData,
  VegaLiteChartElement,
} from "./arrowUtils"
import { applyStreamlitTheme, applyThemeDefaults } from "./CustomTheme"
import {
  StyledVegaLiteChartContainer,
  StyledVegaLiteChartTooltips,
} from "./styled-components"

const DEFAULT_DATA_NAME = "source"

/**
 * Fix bug where Vega Lite was vertically-cropping the x-axis in some cases.
 */
const BOTTOM_PADDING = 20

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

export interface Props {
  element: VegaLiteChartElement
  width: number
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
}

/**
 * Prepares the vega-lite spec for selections by transforming the select parameters
 * to a full object specification and by automatically adding encodings (if missing)
 * to point selections.
 *
 * The changes are applied in-place to the spec object.
 *
 * @param spec The Vega-Lite specification of the chart.
 */
export function prepareSpecForSelections(spec: any): void {
  if ("params" in spec && "encoding" in spec) {
    spec.params.forEach((param: any) => {
      if (!("select" in param)) {
        // We are only interested in transforming select parameters.
        // Other parameters are skipped.
        return
      }

      if (["interval", "point"].includes(param.select)) {
        // The select object can be either a single string (short-hand) specifying
        // "interval" or "point" or an object that can contain additional
        // properties as defined here: https://vega.github.io/vega-lite/docs/selection.html
        // We convert the short-hand notation to the full object specification,
        // so that we can attach additional properties to this below.
        param.select = {
          type: param.select,
        }
      }

      if (!("type" in param.select)) {
        // The type property is required in the spec.
        // But we check anyways and skip all parameters that don't have it.
        return
      }

      if (
        param.select.type === "point" &&
        !("encodings" in param.select) &&
        isNullOrUndefined(param.select.encodings)
      ) {
        // If encodings are not specified by the user, we add all the encodings from
        // the chart to the selection parameter. This is required so that points
        // selections are correctly resolved to a PointSelection and not an IndexSelection:
        // https://github.com/altair-viz/altair/issues/3285#issuecomment-1858860696
        param.select.encodings = Object.keys(spec.encoding)
      }
    })
  }
}

const generateSpec = (
  inputSpec: string,
  useContainerWidth: boolean,
  vegaLiteTheme: string,
  selectionMode: string[],
  theme: EmotionTheme,
  isFullScreen: boolean,
  width: number,
  height?: number
): any => {
  const spec = JSON.parse(inputSpec)
  if (vegaLiteTheme === "streamlit") {
    spec.config = applyStreamlitTheme(spec.config, theme)
  } else if (spec.usermeta?.embedOptions?.theme === "streamlit") {
    spec.config = applyStreamlitTheme(spec.config, theme)
    // Remove the theme from the usermeta so it doesn't get picked up by vega embed.
    spec.usermeta.embedOptions.theme = undefined
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.config = applyThemeDefaults(spec.config, theme)
  }

  if (isFullScreen) {
    spec.width = width
    spec.height = height

    if ("vconcat" in spec) {
      spec.vconcat.forEach((child: any) => {
        child.width = width
      })
    }
  } else if (useContainerWidth) {
    spec.width = width

    if ("vconcat" in spec) {
      spec.vconcat.forEach((child: any) => {
        child.width = width
      })
    }
  }

  if (!spec.padding) {
    spec.padding = {}
  }

  if (isNullOrUndefined(spec.padding.bottom)) {
    spec.padding.bottom = BOTTOM_PADDING
  }

  if (spec.datasets) {
    throw new Error("Datasets should not be passed as part of the spec")
  }

  if (selectionMode.length > 0) {
    prepareSpecForSelections(spec)
  }
  return spec
}

const ArrowVegaLiteChart: FC<Props> = ({
  disableFullscreenMode,
  element,
  fragmentId,
  widgetMgr,
}) => {
  const theme = useTheme()
  const {
    expanded: isFullScreen,
    width,
    height,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const vegaView = useRef<vega.View | null>(null)
  const vegaFinalizer = useRef<(() => void) | null>(null)
  const defaultDataName = useRef<string>(DEFAULT_DATA_NAME)
  const [error, setError] = useState<Error | null>(null)

  const finalizeView = useCallback(() => {
    if (vegaFinalizer.current) {
      vegaFinalizer.current()
    }

    vegaFinalizer.current = null
    vegaView.current = null
  }, [])
  const {
    id: chartId,
    data,
    datasets,
    formId,
    spec: inputSpec,
    useContainerWidth,
    selectionMode: inputSelectionMode,
    vegaLiteTheme,
  } = element
  const selectionMode = useMemo(() => {
    return inputSelectionMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(element.selectionMode)])

  const maybeConfigureSelections = useCallback((): void => {
    if (vegaView.current === null) {
      // This check is mainly to make the type checker happy.
      // this.vegaView is guaranteed to be defined here.
      return
    }

    if (!chartId || selectionMode.length === 0) {
      // To configure selections, it needs to be activated and
      // the element ID must be set.
      return
    }

    // Try to load the previous state of the chart from the element state.
    // This is useful to restore the selection state when the component is re-mounted
    // or when its put into fullscreen mode.
    const viewState = widgetMgr.getElementState(chartId, "viewState")
    if (notNullOrUndefined(viewState)) {
      try {
        vegaView.current = vegaView.current.setState(viewState)
      } catch (e) {
        logWarning("Failed to restore view state", e)
      }
    }

    // Add listeners for all selection events. Find out more here:
    // https://vega.github.io/vega/docs/api/view/#view_addSignalListener
    selectionMode.forEach((param, _index) => {
      vegaView.current?.addSignalListener(
        param,
        debounce(DEBOUNCE_TIME_MS, (name: string, value: SignalValue) => {
          // Store the current chart selection state with the widget manager so that it
          // can be used for restoring the state when the component unmounted and
          // created again. This can happen when elements are added before it within
          // the delta path. The viewState is only stored in the frontend, and not
          // synced to the backend.
          const viewState = vegaView.current?.getState({
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
  }, [chartId, selectionMode, widgetMgr, formId, fragmentId])

  const spec = useMemo(
    () =>
      generateSpec(
        inputSpec,
        useContainerWidth,
        vegaLiteTheme,
        selectionMode,
        theme,
        isFullScreen,
        width,
        height
      ),
    [
      inputSpec,
      useContainerWidth,
      vegaLiteTheme,
      selectionMode,
      theme,
      isFullScreen,
      width,
      height,
    ]
  )

  const createView = useCallback(async (): Promise<void> => {
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

      maybeConfigureSelections()

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
  }, [finalizeView, spec, maybeConfigureSelections, datasets, data])

  useEffect(() => {
    if (vegaView.current) {
      logMessage("Vega spec changed.")
    } else {
      logMessage("View does not exist yet")
    }

    createView()

    return finalizeView()
  }, [spec, theme, width, height, selectionMode, createView, finalizeView])

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
          vegaView.current.remove(name, vega.truthy)
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

  if (error) {
    throw error
  }

  // Create the container inside which Vega draws its content.
  // To style the Vega tooltip, we need to apply global styles since
  // the tooltip element is drawn outside of this component.
  return (
    <StyledToolbarElementContainer
      width={width}
      height={height}
      useContainerWidth={element.useContainerWidth}
    >
      <Toolbar
        target={StyledToolbarElementContainer}
        isFullScreen={isFullScreen}
        onExpand={expand}
        onCollapse={collapse}
        disableFullscreenMode={disableFullscreenMode}
      ></Toolbar>
      <Global styles={StyledVegaLiteChartTooltips} />
      <StyledVegaLiteChartContainer
        data-testid="stVegaLiteChart"
        className="stVegaLiteChart"
        useContainerWidth={element.useContainerWidth}
        isFullScreen={isFullScreen}
        ref={containerRef}
      />
    </StyledToolbarElementContainer>
  )
}

export default withFullScreenWrapper(ArrowVegaLiteChart)
