#!/bin/sh
# Print every league/tournament slug the lolesports API currently knows.
# Usage: ./scripts/list-leagues.sh
API_KEY="0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"
curl -sf "https://esports-api.lolesports.com/persisted/gw/getLeagues?hl=en-US" \
  -H "x-api-key: $API_KEY" |
  osascript -l JavaScript -e '
    function run() {
      const raw = $.NSString.alloc.initWithDataEncoding(
        $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile, $.NSUTF8StringEncoding).js;
      return JSON.parse(raw).data.leagues
        .map(l => `${l.slug.padEnd(28)} ${l.id.padEnd(20)} ${l.name.trim()} (${l.region})`)
        .join("\n");
    }'
