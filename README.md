## Dev
```sh
python -m http.server
```

## Debug completion

When `ENABLE_CONSOLE_COMPLETION` is `true` in `src/debug-config.js`, the browser
console exposes:

```js
completeCurrentLevel()
```

Set the flag to `false` for production builds to omit this command.
