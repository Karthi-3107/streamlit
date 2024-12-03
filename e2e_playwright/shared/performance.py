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

from __future__ import annotations

import datetime
import json
import os
from contextlib import contextmanager
from functools import wraps
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from playwright.sync_api import Page


@contextmanager
def with_cdp_session(page: Page):
    """
    Create a new Chrome DevTools Protocol session.
    Detach the session when the context manager exits.
    """
    client = page.context.new_cdp_session(page)
    yield client
    client.detach()


# Observe long tasks, measure, marks, and paints with PerformanceObserver
# @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
CAPTURE_TRACES_SCRIPT = """
window.__capturedTraces = {};

function handleEntries(list) {
    const entries = list.getEntries();
    for (const entry of entries) {
        if (!window.__capturedTraces[entry.entryType]) {
            window.__capturedTraces[entry.entryType] = [];
        }
        window.__capturedTraces[entry.entryType].push(entry);
    }
}

new PerformanceObserver(handleEntries).observe({
    entryTypes: ['longtask', 'measure', 'mark', 'navigation', 'paint', 'long-animation-frame'],
});
"""

GET_CAPTURED_TRACES_SCRIPT = """
JSON.stringify(window.__capturedTraces)
"""


@contextmanager
def measure_performance(
    page: Page, *, test_name: str, cpu_throttling_rate: int | None = None
):
    """
    Measure the performance of the page using the native performance API from
    Chrome DevTools Protocol.
    @see https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.page.metrics.md

    Args:
        page (Page): The page to measure performance on.
        cpu_throttling_rate (int | None, optional): Throttling rate as a slowdown factor (1 is no throttle, 2 is 2x slowdown, etc). Defaults to None.
    """
    with with_cdp_session(page) as client:
        if cpu_throttling_rate is not None:
            client.send("Emulation.setCPUThrottlingRate", {"rate": cpu_throttling_rate})

        client.send("Performance.enable")
        client.send("Runtime.evaluate", {"expression": CAPTURE_TRACES_SCRIPT})

        # Run the test
        yield

        metrics_response = client.send("Performance.getMetrics")
        captured_traces = client.send(
            "Runtime.evaluate",
            {"expression": GET_CAPTURED_TRACES_SCRIPT},
        )["result"]["value"]
        parsed_captured_traces = json.loads(captured_traces)

        # Ensure the directory exists
        os.makedirs("./performance-results", exist_ok=True)

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

        with open(f"./performance-results/{timestamp}_{test_name}.json", "w") as f:
            json.dump(
                {
                    "metrics": metrics_response["metrics"],
                    "capturedTraces": parsed_captured_traces,
                },
                f,
            )


def with_performance(*, cpu_throttling_rate: int | None = None):
    """
    A decorator to measure the performance of a test function.

    Args:
        cpu_throttling_rate (int | None, optional): Throttling rate as a slowdown factor (1 is no throttle, 2 is 2x slowdown, etc). Defaults to None.

    Returns:
        Callable: The decorated test function with performance measurement.
    """

    def decorator(test_func: Callable):
        @wraps(test_func)
        def wrapper(*args, **kwargs):
            """
            Wrapper function to measure performance.

            Args:
                *args: Positional arguments for the test function.
                **kwargs: Keyword arguments for the test function.
            """

            browser_name = kwargs.get("browser_name")
            # Only measure performance for Chromium browsers since it relies on
            # Chrome DevTools Protocol under the hood
            if browser_name != "chromium":
                return test_func(*args, **kwargs)

            page = (
                kwargs.get("themed_app")
                or kwargs.get("page")
                or kwargs.get("app")
                or args[0]
            )
            with measure_performance(
                page,
                test_name=test_func.__name__,
                cpu_throttling_rate=cpu_throttling_rate,
            ):
                test_func(*args, **kwargs)

        return wrapper

    return decorator
