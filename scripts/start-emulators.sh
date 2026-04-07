#!/bin/bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
cd "$(dirname "$0")/.."
firebase emulators:start
