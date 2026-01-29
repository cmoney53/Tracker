#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Install project dependencies
npm install

# 2. Install Chrome and the required Linux system libraries
# This is the secret to 100% success on Render
npx puppeteer browsers install chrome --with-deps
