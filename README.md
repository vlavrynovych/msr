# Migration Script Runner

*TODO: point labels to master*

[![Build Status](https://app.travis-ci.com/vlavrynovych/msr.svg?branch=develop)](https://app.travis-ci.com/vlavrynovych/msr)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/vlavrynovych/msr/tree/develop.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/vlavrynovych/msr/tree/develop)
[![Coverage Status](https://coveralls.io/repos/github/vlavrynovych/msr/badge.svg?branch=develop)](https://coveralls.io/github/vlavrynovych/msr?branch=develop)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![GitHub issues](https://img.shields.io/github/issues/vlavrynovych/msr.svg)](https://github.com/vlavrynovych/msr/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/vlavrynovych/msr/develop/LICENSE)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
![Static Badge](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)

[//]: # ([![NPM]&#40;https://nodei.co/npm/migration-script-runner.png?downloads=true&#41;]&#40;https://nodei.co/npm/migration-script-runner/&#41;)
[//]: # ([![SonarCloud]&#40;https://sonarcloud.io/images/project_badges/sonarcloud-white.svg&#41;]&#40;https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr&#41;)

[npm-image]: https://img.shields.io/npm/v/migration-script-runner.svg?style=flat
[npm-url]: https://npmjs.org/package/migration-script-runner
[npm-downloads-image]: https://img.shields.io/npm/dm/migration-script-runner.svg?style=flat


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

Runs tests

```shell
npm run test:report
```

Runs all tests and generates all the reports: junit, eslint, code coverage

## Inspiration

I originally created this to solve a problem I was having with my pet projects. I believe that it can be especially handy 
if you have a deal with a new DBMS or there is still no public libraries available at the moment.