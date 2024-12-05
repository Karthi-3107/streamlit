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

from playwright.sync_api import Page

from e2e_playwright.conftest import wait_for_app_run


def test_form_interaction_perf_1(app: Page):
    app.get_by_test_id("stTextArea").nth(0).locator("textarea").press_sequentially(
        "this is some text", delay=100
    )
    wait_for_app_run(app)


def test_form_interaction_perf_2(app: Page):
    form_1 = app.get_by_test_id("stForm").nth(0)
    form_1.get_by_test_id("stTextArea").locator("textarea").press_sequentially(
        "this is some text", delay=100
    )
    # form_1.get_by_test_id("stFormSubmitButton").last.click()
    wait_for_app_run(app)
