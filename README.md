# Migration Script Runner
An abstract implementation of script runner which can be extended by your own implementation

## Development

### Scripts overview

```shell
npm run build
```

Builds the app at build, cleaning the folder first.

```shell
npm run start:js
```

Starts the app in production by first building the project with npm run build, and then executing the compiled JavaScript at build/index.js.

```shell
npm run start:ts
```

Starts the app directly from ./index.ts.

### Local developments

```shell
npm run start:dev
```
Starts the application in development using nodemon and ts-node to do cold reloading.


```shell
npm run test
```

Starts unit tests

```shell
npm run coverage
```

Starts unit tests with coverage

## Inspiration

I originally created this to solve a problem I was having with my pet projects. I believe that it can be especially handy 
if you have a deal with a new DBMS or there is still no public libraries available at the moment.