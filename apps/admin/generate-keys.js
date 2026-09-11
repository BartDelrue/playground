import * as crypto from "node:crypto";
import * as readline from "node:readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function generateKeys(names) {
    const usedKeys = new Set()
    const result = names.map(name => {
        let key
        do key = crypto.randomBytes(3).toString('hex')
        while (usedKeys.has(key))

        usedKeys.add(key)
        return {name, key}
    })

    console.log(`\n--- Copy these ${result.length} keys into keys.json ---`);
    console.log(JSON.stringify(result, null, 2));
    console.log("--------------------------------------------------\n");
}

const lines = []
console.log('Paste names (comma separated or one per line), then enter "done":')

rl.on('line', (line) => {
    if (line.trim() === 'done') {
        const names = lines
            .join(',')
            .split(/[\n,]/)
            .map(s => s.trim())
            .filter(Boolean)

        console.log(names)
        generateKeys(names);
        rl.close()
    } else {
        lines.push(line)
    }
});