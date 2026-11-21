#!/bin/bash
export PATH="/Users/stijnvoorhoeve/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd /Users/stijnvoorhoeve/rate-my-day
exec npx expo start --tunnel --non-interactive
