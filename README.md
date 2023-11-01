# msr
Migration Script Runner

## Scripts overview

```shell
npm run start:dev
```
Starts the application in development using nodemon and ts-node to do cold reloading.

```shell
npm run build
```

Builds the app at build, cleaning the folder first.

```shell
npm run start
```

Starts the app in production by first building the project with npm run build, and then executing the compiled JavaScript at build/index.js.