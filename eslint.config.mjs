import eslint from '@gewis/js-configs/eslint.common.mjs';
import prettier from '@gewis/js-configs/eslint.prettier.mjs';

export default [
    ...eslint,
    ...prettier,
];