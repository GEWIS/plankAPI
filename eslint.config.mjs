import eslint from '@gewis/eslint-config/eslint.common.mjs';
import prettier from '@gewis/eslint-config/eslint.prettier.mjs';

export default [
    ...eslint,
    {
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    ...prettier,
];