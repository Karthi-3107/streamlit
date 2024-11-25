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
from typing import TYPE_CHECKING

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


@contextmanager
def measure_performance(page: Page, *, cpu_throttling_rate: int | None = None):
    """
    Measure the performance of the page using the native performance API from
    Chrome DevTools Protocol.
    @see https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.page.metrics.md
    """
    with with_cdp_session(page) as client:
        if cpu_throttling_rate is not None:
            client.send("Emulation.setCPUThrottlingRate", {"rate": cpu_throttling_rate})

        client.send("Performance.enable")

        # Observe long tasks with PerformanceObserver
        # @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
        client.send(
            "Runtime.evaluate",
            {
                "expression": """
                window.longTasks = [];

                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    for (const entry of entries) {
                        window.longTasks.push(entry);
                    }
                }).observe({entryTypes: ['longtask', 'measure', 'mark', 'paint']});
                """
            },
        )

        yield

        metrics_response = client.send("Performance.getMetrics")
        long_tasks = client.send(
            "Runtime.evaluate", {"expression": "JSON.stringify(window.longTasks)"}
        )["result"]["value"]
        parsed_long_tasks = json.loads(long_tasks)

        # Ensure the directory exists
        os.makedirs("./performance/results", exist_ok=True)

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        with open(f"./performance/results/performance_{timestamp}.json", "w") as f:
            json.dump(
                {
                    "metrics": metrics_response["metrics"],
                    "longTasks": parsed_long_tasks,
                },
                f,
            )
