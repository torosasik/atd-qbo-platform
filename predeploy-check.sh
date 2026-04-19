#!/bin/bash
EXPECTED="atd-qbo-platform"
ACTUAL=$(cat .firebaserc | python3 -c "import json,sys; print(json.load(sys.stdin)['projects']['default'])")
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "ERROR: Wrong Firebase project! Expected $EXPECTED but got $ACTUAL"
  exit 1
fi
echo "Project check passed: $ACTUAL"
