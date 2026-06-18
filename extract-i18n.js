import fs from 'fs';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import generator from '@babel/generator';
import t from '@babel/types';

const code = fs.readFileSync('src/ImmigrationMVP.jsx', 'utf-8');

const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
});

const dict = {};
let counter = 0;

function hasCyrillic(text) {
    return /[а-яА-ЯёЁ]/.test(text);
}

function getKey(text) {
    const trimmed = text.trim();
    // Check if we already have this string
    for (const [k, v] of Object.entries(dict)) {
        if (v === trimmed) return k;
    }
    const key = `str_${counter++}`;
    dict[key] = trimmed;
    return key;
}

traverse.default(ast, {
    JSXText(path) {
        if (hasCyrillic(path.node.value)) {
            const text = path.node.value;
            // Split by newlines/spaces if needed, but for simplicity we take the whole string
            if (text.trim().length > 0) {
                const key = getKey(text);
                path.replaceWith(
                    t.jsxExpressionContainer(
                        t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
                    )
                );
            }
        }
    },
    StringLiteral(path) {
        // Only replace if inside JSXAttribute or specific locations, otherwise we might replace imports or config strings
        // But since we check for Cyrillic, it's mostly safe.
        if (hasCyrillic(path.node.value)) {
            const key = getKey(path.node.value);
            
            // If it's a JSX attribute, it needs to be wrapped in JSXExpressionContainer
            if (path.parent.type === 'JSXAttribute') {
                path.replaceWith(
                    t.jsxExpressionContainer(
                        t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
                    )
                );
            } else {
                path.replaceWith(
                    t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
                );
            }
        }
    },
    TemplateLiteral(path) {
        // Template literals with Cyrillic are harder because they have expressions.
        // For simplicity, we can try to extract parts or just skip them and do them manually.
        // Let's check if there are any TemplateLiterals with Cyrillic.
        const hasCyrillicInQuasis = path.node.quasis.some(q => hasCyrillic(q.value.raw));
        if (hasCyrillicInQuasis) {
            console.log("Found Cyrillic in TemplateLiteral, please handle manually:", path.node.quasis.map(q => q.value.raw).join('${...}'));
        }
    }
});

const output = generator.default(ast, {}, code);

fs.writeFileSync('src/ImmigrationMVP_i18n.jsx', output.code);
fs.writeFileSync('src/i18n/ru.json', JSON.stringify(dict, null, 2));

console.log(`Extracted ${counter} strings.`);
