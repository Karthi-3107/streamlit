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

/**
 * A circular buffer implementation.
 */
export class CircularBuffer<T> {
  private _buffer: T[]

  private _size: number

  private _index: number

  private _hasWrapped: boolean

  constructor(size: number) {
    this._buffer = new Array(size)
    this._size = size
    this._index = 0
    this._hasWrapped = false
  }

  push(value: T): void {
    this._buffer[this._index] = value
    this._index = (this._index + 1) % this._size

    if (this._index === 0) {
      this._hasWrapped = true
    }
  }

  get buffer(): T[] {
    return this._buffer
  }

  get hasWrapped(): boolean {
    return this._hasWrapped
  }
}
