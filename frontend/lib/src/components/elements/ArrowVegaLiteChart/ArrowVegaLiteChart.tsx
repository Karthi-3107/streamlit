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
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { Global } from "@emotion/react"

import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import Toolbar, {
  StyledToolbarElementContainer,
} from "@streamlit/lib/src/components/shared/Toolbar"
import { ElementFullscreenContext } from "@streamlit/lib/src/components/shared/ElementFullscreen/ElementFullscreenContext"
import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"
import { withFullScreenWrapper } from "@streamlit/lib/src/components/shared/FullScreenWrapper"

import { VegaLiteChartElement } from "./arrowUtils"
import {
  StyledVegaLiteChartContainer,
  StyledVegaLiteChartTooltips,
} from "./styled-components"
import { useVegaSpecPreprocessor } from "./useVegaSpecPreprocessor"
import { useVegaEmbed } from "./useVegaEmbed"
import { useVegaLiteSelections } from "./useVegaLiteSelection"

export interface Props {
  element: VegaLiteChartElement
  width: number
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
}

enum RenderState {
  PENDING,
  RENDERED,
}

const ArrowVegaLiteChart: FC<Props> = ({
  disableFullscreenMode,
  element,
  fragmentId,
  widgetMgr,
}) => {
  const {
    expanded: isFullScreen,
    width,
    height,
    expand,
    collapse,
  } = useRequiredContext(ElementFullscreenContext)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderedState, setRenderedState] = useState<RenderState>(
    RenderState.PENDING
  )
  const { spec, selectionMode } = useVegaSpecPreprocessor(element)
  const { error, createView, finalizeView } = useVegaEmbed(element)
  const maybeConfigureSelections = useVegaLiteSelections(
    element,
    widgetMgr,
    fragmentId
  )

  const setupView = useCallback(
    async (containerRef: RefObject<HTMLDivElement>) => {
      const vegaView = await createView(containerRef, spec, widgetMgr)
      if (vegaView) {
        maybeConfigureSelections(vegaView)
      }
    },
    [spec, widgetMgr, selectionMode]
  )

  const setContainerRef = useCallback(async (el: HTMLDivElement) => {
    containerRef.current = el

    setupView(containerRef)
  }, [])

  useEffect(() => {
    setupView(containerRef)

    return finalizeView
  }, [setupView, finalizeView])

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
        ref={setContainerRef}
      />
    </StyledToolbarElementContainer>
  )
}

export default withFullScreenWrapper(ArrowVegaLiteChart)
