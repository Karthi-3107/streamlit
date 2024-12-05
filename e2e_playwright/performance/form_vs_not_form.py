# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from datetime import date, time

import streamlit as st

st.text_area("Text Area not in Form", value="foo")

with st.form("form_1"):
    text_area = st.text_area("Text Area", value="foo")
    checkbox = st.checkbox("Checkbox", False)
    date_input = st.date_input("Date Input", date(2019, 7, 6))
    multiselect = st.multiselect("Multiselect", ["foo", "bar"], default=["foo"])
    number_input = st.number_input("Number Input")
    radio = st.radio("Radio", ["foo", "bar", "baz"])
    selectbox = st.selectbox("Selectbox", ["foo", "bar", "baz"])
    select_slider = st.select_slider("Select Slider", ["foo", "bar", "baz"])
    slider = st.slider("Slider")
    text_input = st.text_input("Text Input", value="foo")
    time_input = st.time_input("Time Input", time(8, 45))
    toggle_input = st.toggle("Toggle Input", value=False)
    st.form_submit_button("Submit")


with st.sidebar:
    st.button("Click me")
    st.checkbox("Check me")
    st.radio("Radio", ["foo", "bar", "baz"])
    st.selectbox("Selectbox", ["foo", "bar", "baz"])
    st.multiselect("Multiselect", ["foo", "bar", "baz"])
