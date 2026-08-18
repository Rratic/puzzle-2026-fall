## Dev
```sh
python -m http.server
```

设置存档为全部通过：

```js
const ids = [
  "library", "mines", "maps", "hyperbolic", "compass",
  "numbers", "quadratic", "knots", "ritual",
];
localStorage.setItem("progress", JSON.stringify(
  Object.fromEntries(ids.map((id) => [id, {
    completed: true,
    durationMs: 0,
    canvasMs: [],
  }])),
));
location.hash = "#results";
location.reload();
```
