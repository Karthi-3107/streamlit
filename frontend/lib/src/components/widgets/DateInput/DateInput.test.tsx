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

import React from "react"

import "@testing-library/jest-dom"
import { fireEvent, screen, act } from "@testing-library/react"

import { render } from "@streamlit/lib/src/test_util"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  DateInput as DateInputProto,
  LabelVisibilityMessage as LabelVisibilityMessageProto,
} from "@streamlit/lib/src/proto"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"

import DateInput, { Props } from "./DateInput"

const originalDate = "1970/1/20"
const fullOriginalDate = "1970/01/20"
const newDate = "2020/02/06"

const getProps = (
  elementProps: Partial<DateInputProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: DateInputProto.create({
    id: "1",
    label: "Label",
    default: [fullOriginalDate],
    min: originalDate,
    format: "YYYY/MM/DD",
    ...elementProps,
  }),
  width: 0,
  disabled: false,
  theme: mockTheme.emotion,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: jest.fn(),
    formsDataChanged: jest.fn(),
  }),
  ...widgetProps,
})

describe("DateInput widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<DateInput {...props} />)
    expect(screen.getByTestId("stDateInput")).toBeInTheDocument()
  })

  it("renders a label", () => {
    const props = getProps()
    render(<DateInput {...props} />)
    expect(screen.getByText("Label")).toBeInTheDocument()
  })

  it("displays the correct placeholder and value for the provided format", () => {
    const props = getProps({
      format: "DD.MM.YYYY",
    })
    render(<DateInput {...props} />)
    expect(screen.getByPlaceholderText("DD.MM.YYYY")).toBeInTheDocument()
    expect(screen.getByDisplayValue("20.01.1970")).toBeInTheDocument()
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.HIDDEN,
      },
    })
    render(<DateInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle(
      "visibility: hidden"
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: {
        value: LabelVisibilityMessageProto.LabelVisibilityOptions.COLLAPSED,
      },
    })
    render(<DateInput {...props} />)
    expect(screen.getByTestId("stWidgetLabel")).toHaveStyle("display: none")
  })

  it("sets widget value on render", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [fullOriginalDate],
      {
        fromUi: false,
      },
      undefined
    )
  })

  it("can pass a fragmentId to setStringArrayValue", () => {
    const props = getProps(undefined, { fragmentId: "myFragmentId" })
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [fullOriginalDate],
      {
        fromUi: false,
      },
      "myFragmentId"
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInput")
    expect(dateInput).toHaveAttribute("class", "stDateInput")
    expect(dateInput).toHaveStyle("width: 0px;")
  })

  it("renders a default value", () => {
    const props = getProps()
    render(<DateInput {...props} />)

    expect(screen.getByTestId("stDateInputField")).toHaveValue(
      fullOriginalDate
    )
  })

  it("can be disabled", () => {
    const props = getProps()
    render(<DateInput {...props} disabled={true} />)
    expect(screen.getByTestId("stDateInputField")).toBeDisabled()
  })

  it("updates the widget value when it's changed", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const datePicker = screen.getByTestId("stDateInputField")
    fireEvent.change(datePicker, { target: { value: newDate } })

    expect(screen.getByTestId("stDateInputField")).toHaveValue(newDate)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDate],
      {
        fromUi: true,
      },
      undefined
    )
  })

  it("resets its value to default when it's closed with empty input", () => {
    const props = getProps()
    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)
    const dateInput = screen.getByTestId("stDateInputField")

    fireEvent.change(dateInput, {
      target: { value: newDate },
    })

    expect(dateInput).toHaveValue(newDate)

    // Simulating clearing the date input
    fireEvent.change(dateInput, {
      target: { value: null },
    })

    // Simulating the close action
    fireEvent.blur(dateInput)
    expect(dateInput).toHaveValue(fullOriginalDate)
  })

  it("has a minDate", async () => {
    const props = getProps({})

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")

    await act(() => {
      fireEvent.focus(dateInput)
    })

    screen.getByLabelText("Not available. Monday, January 19th 1970.")
    screen.getByLabelText(
      "Selected. Tuesday, January 20th 1970. It's available."
    )
  })

  it("has a minDate if passed", async () => {
    const props = getProps({
      min: "2020/01/05",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020/01/15"],
    })

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")

    await act(() => {
      fireEvent.focus(dateInput)
    })

    screen.getByLabelText("Not available. Saturday, January 4th 2020.")
    screen.getByLabelText("Choose Sunday, January 5th 2020. It's available.")
  })

  it("has a maxDate if it is passed", async () => {
    const props = getProps({
      max: "2020/01/25",
      // Choose default so min is in the default page when the widget is opened.
      default: ["2020/01/15"],
    })

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")

    await act(() => {
      fireEvent.focus(dateInput)
    })

    screen.getByLabelText(
      "Choose Saturday, January 25th 2020. It's available."
    )
    screen.getByLabelText("Not available. Sunday, January 26th 2020.")
  })

  it("resets its value when form is cleared", async () => {
    // Create a widget in a clearOnSubmit form
    const props = getProps({ formId: "form" })
    props.widgetMgr.setFormClearOnSubmit("form", true)

    jest.spyOn(props.widgetMgr, "setStringArrayValue")

    render(<DateInput {...props} />)

    const dateInput = screen.getByTestId("stDateInputField")
    fireEvent.change(dateInput, {
      target: { value: newDate },
    })

    expect(dateInput).toHaveValue(newDate)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenCalledWith(
      props.element,
      [newDate],
      {
        fromUi: true,
      },
      undefined
    )

    await act(() => {
      // "Submit" the form
      props.widgetMgr.submitForm("form", undefined)
    })

    // Our widget should be reset, and the widgetMgr should be updated
    expect(dateInput).toHaveValue(fullOriginalDate)
    expect(props.widgetMgr.setStringArrayValue).toHaveBeenLastCalledWith(
      props.element,
      [fullOriginalDate],
      {
        fromUi: true,
      },
      undefined
    )
  })
})
