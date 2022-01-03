import 'should';

// TODO: programmatically find these values. But this seems to work fine.
export const nonExistentUidGid = Number(process.env.NONEXISTENT_ID || -42);
export const nonExistentUserGroup = process.env.NONEXISTENT_NAME ?? '';

/**
 * Helper function to exercise Error condition coverage tests.
 * Since all the functions error in pretty much the same way, we can take advantage of this.
 *
 * @param {Function} test to run
 * @param {"string" | "number"} argumentType What the method expects as an argument
 * @param {String} missingMessage name of argument
 * @param {String} errorMessage string when not found
 * @param {Object} options Extra options
 */
export function itShouldHandleErrorsConsistently(
  test: (...args: never[]) => void,
  // TODO: Use automatic/generic typing to determine this automatically
  argumentType: 'string' | 'number',
  missingMessage: string,
  errorMessage: string,
  options: {
    badValue?: number | string;
    missingValue?: number | string;
  } = {},
) {
  const badValue = options.badValue ?? argumentType === 'string' ? 0 : 'not a number';
  const missingValue = options.missingValue ?? argumentType === 'string' ? nonExistentUserGroup : nonExistentUidGid;

  it('should throw with too few arguments', () => {
    (() => test()).should.throw('Wrong number of arguments');
  });

  it(`should throw with the wrong type of argument. Expects ${argumentType}, giving ${typeof badValue} [${badValue}].`, () => {
    (() => test(badValue as never)).should.throw(`Argument must be a ${argumentType}`);
  });

  it(`should throw when ${missingMessage} [${missingValue}] can't be found`, () => {
    (() => test(missingValue as never)).should.throw(errorMessage);
  });
}
