# Mutation Testing Guide

This project uses [Stryker Mutator](https://stryker-mutator.io/) for mutation testing to verify the quality of our test suite.

## What is Mutation Testing?

Mutation testing validates test quality by:
1. Introducing intentional bugs ("mutations") into the source code
2. Running the test suite against each mutation
3. Checking if tests catch the bugs

If tests don't catch a mutation, it indicates:
- Missing test coverage
- Weak test assertions
- Tests that don't actually verify behavior

## Running Mutation Tests

### Full Mutation Test Run

⚠️ **Warning**: This is slow! Expect 30-60 minutes for the first run.

```bash
npm run test:mutation
```

### Incremental Mutation Testing

Only tests changes since the last run (much faster for iterative development):

```bash
npm run test:mutation:incremental
```

### View Results

After running, open the HTML report:

```bash
open reports/mutation/mutation-report.html
```

## Understanding the Results

### Mutation Score

The **mutation score** indicates test quality:
- **90-100%**: Excellent - Tests catch almost all bugs
- **80-89%**: Good - Most bugs are caught
- **60-79%**: Fair - Significant gaps in test coverage
- **< 60%**: Poor - Tests may miss critical bugs

### Mutation Status

- **Killed**: ✅ Test detected the mutation (good!)
- **Survived**: ❌ Mutation wasn't caught by tests (bad!)
- **Timeout**: ⏱️ Test took too long (possible infinite loop)
- **No Coverage**: 📍 Code not covered by any test
- **Runtime Error**: 💥 Mutation caused a crash (good!)

## Configuration

See `stryker.conf.json` for configuration:
- **mutate**: Which files to mutate
- **thresholds**: Quality thresholds
  - `break: 50%` - Build fails below 50%
  - `low: 60%` - Warning below 60%
  - `high: 80%` - Target above 80%
- **maxConcurrentTestRunners**: Parallel test execution (adjust based on your CPU)

## Performance Tips

1. **Use incremental mode** during development
2. **Increase `maxConcurrentTestRunners`** if you have a powerful CPU
3. **Exclude slow tests** from mutation testing (if any)
4. **Run mutation tests in CI/CD** overnight or on a schedule

## Common Mutations

Stryker tests various mutation types:

| Mutation Type | Example | Description |
|---------------|---------|-------------|
| **Arithmetic** | `+` → `-` | Changes operators |
| **Conditional** | `>` → `>=` | Modifies comparisons |
| **Boolean** | `&&` → `\|\|` | Alters logic |
| **String** | `"text"` → `""` | Changes literals |
| **Array** | `arr.length` → `0` | Modifies arrays |
| **Block** | Removes statements | Tests statement necessity |

## Improving Mutation Score

If mutations survive:

1. **Add missing assertions**: Tests may be too vague
   ```typescript
   // Bad
   it('should return result', () => {
     const result = calculate(5);
     expect(result).toBeDefined(); // Weak!
   });

   // Good
   it('should return result', () => {
     const result = calculate(5);
     expect(result).toBe(25); // Specific!
   });
   ```

2. **Test edge cases**: Boundary conditions often survive
   ```typescript
   it('should handle zero', () => {
     expect(calculate(0)).toBe(0);
   });

   it('should handle negative numbers', () => {
     expect(calculate(-5)).toBe(25);
   });
   ```

3. **Test error paths**: Ensure error handling is tested
   ```typescript
   it('should throw on invalid input', () => {
     expect(() => calculate(null)).toThrow();
   });
   ```

## CI/CD Integration

Add to your CI/CD pipeline (e.g., CircleCI):

```yaml
- run:
    name: Mutation Testing
    command: npm run test:mutation
    # Only run on main branch or PRs to avoid slowing down all builds
    when: << pipeline.git.branch >> == "main"
```

## Troubleshooting

### "Stryker is stuck"

- Check `reports/mutation/mutation-report.html` for timeout mutations
- Increase `timeoutMS` in `stryker.conf.json`

### "Out of memory"

- Reduce `maxConcurrentTestRunners` in `stryker.conf.json`
- Increase Node memory: `NODE_OPTIONS=--max_old_space_size=4096 npm run test:mutation`

### "Too slow"

- Use incremental mode: `npm run test:mutation:incremental`
- Exclude benchmark tests temporarily
- Run on powerful CI/CD servers instead of locally

## References

- [Stryker Documentation](https://stryker-mutator.io/)
- [Mutation Testing Explained](https://stryker-mutator.io/docs/mutation-testing-elements/introduction/)
- [Best Practices](https://stryker-mutator.io/docs/General/guides/best-practices/)
