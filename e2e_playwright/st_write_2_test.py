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

from playwright.sync_api import Page, expect


def test_display_dataframe(app: Page):
    """Test that st.write displays dataframe compatible objects via st.dataframe."""

    dataframe_element = app.get_by_test_id("stDataFrame")
    expect(dataframe_element).to_have_count(4)


def test_display_json(app: Page):
    """Test that st.write displays dicts and arrays as json data."""
    json_elements = app.get_by_test_id("stJson")
    expect(json_elements).to_have_count(6)


def test_display_help(app: Page):
    """Test that st.write displays objects via st.help."""
    help_elements = app.get_by_test_id("stHelp")
    expect(help_elements).to_have_count(3)


def test_display_exception(app: Page):
    """Test that st.write displays exceptions via st.exception."""
    exception_elements = app.get_by_test_id("stException")
    expect(exception_elements).to_have_count(1)


def test_display_images(app: Page):
    """Test that st.write displays images (including matplotlib charts)."""
    image_elements = app.get_by_test_id("stImage")
    expect(image_elements).to_have_count(2)


def test_display_altair(app: Page):
    """Test that st.write displays altair charts."""
    altair_elements = app.get_by_test_id("stVegaLiteChart")
    expect(altair_elements).to_have_count(1)


def test_display_plotly(app: Page):
    """Test that st.write displays plotly charts."""
    plotly_elements = app.get_by_test_id("stPlotlyChart")
    expect(plotly_elements).to_have_count(1)


def test_display_graphviz(app: Page):
    """Test that st.write displays graphviz charts."""
    plotly_elements = app.get_by_test_id("stGraphVizChart")
    expect(plotly_elements).to_have_count(1)


def test_display_pydeck_chart(app: Page):
    """Test that st.write displays pydeck charts."""
    pydeck_elements = app.get_by_test_id("stDeckGlJsonChart")
    # The pydeck chart takes a while to load so check that
    # it gets attached with an increased timeout.
    expect(pydeck_elements).to_have_count(1, timeout=15000)
