import puppeteer from "puppeteer";
import { vkey } from "../helpers/vkey";
import { do_generate } from "../scripts/generate_input";

declare var snarkjs: any;


const runBenchmark = async (cap: any) => {
    console.log("Setting up test -->", cap['name'])
    if (!process.env.EMAIL_FILE_PATH) {
        throw new Error("EMAIL_FILE_PATH not found, please provide a valid email to test with");
    }

    const inputs = await do_generate(process.env.EMAIL_FILE_PATH);
    const toInject = {
        inputs,
        vkey,
    }

    console.log("Starting test -->", cap['name'])

    cap['browserstack.username'] = process.env.BROWSERSTACK_USERNAME || 'YOUR_USERNAME';
    cap['browserstack.accessKey'] = process.env.BROWSERSTACK_ACCESS_KEY || 'YOUR_ACCESS_KEY';
    cap["browserstack.console"] = "verbose";

    const browser = await puppeteer.connect({
      browserWSEndpoint:
      `wss://cdp.browserstack.com/puppeteer?caps=${encodeURIComponent(JSON.stringify(cap))}`,  // The BrowserStack CDP endpoint gives you a `browser` instance based on the `caps` that you specified
    });


    const page = await browser.newPage();
    await page.goto(process.env.SNARKJS_WEB_SITE || "https://immanuelsegol.github.io/");
    
    // wait for title to load 
    await page.title();

    const benchmark_results = await page.evaluate(async (toInject) => {
        const { inputs, vkey } = toInject;

        async function generateProof(input: any, filename: any) {
            // TODO: figure out how to generate this s.t. it passes build
            console.log("generating proof for input");
            console.log(input);
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `https://zkemail-zkey-chunks.s3.amazonaws.com/${filename}.wasm`, `${filename}.zkey`);
            console.log(`Generated proof ${JSON.stringify(proof)}`);
          
            return {
              proof,
              publicSignals,
            };
        }

        async function verifyProof(proof: any, publicSignals: any, vkey: any) {
            const proofVerified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
          
            return proofVerified;
        }

        const { proof, publicSignals } = await generateProof(inputs, "email");
        
        const res = await verifyProof(proof, publicSignals, vkey);

    }, toInject);

    console.log("Benchmark results");
    console.log(benchmark_results, cap);
    console.log("Benchmark results");
    await browser.close();
};



const benches = [
{
    prover: "groth16",
    lang: "circom",
    circuit: "poseidonex_test",
}
]

const platforms = [
{
    'browser': 'chrome',
    'browser_version': 'latest',
    'os': 'osx',
    'os_version': 'catalina',
    'name': 'Chrome latest on Catalina',
    'build': 'puppeteer-build-2'
},
{
    'browser': 'firefox',
    'browser_version': 'latest',
    'os': 'osx',
    'os_version': 'catalina',
    'name': 'Firefox latest on Catalina',
    'build': 'puppeteer-build-2'
}];

benches.forEach(b => {
switch (b.prover) {
    case "groth16":
    platforms.forEach(async (cap) => {
        await runBenchmark(cap);
    });
    return
    default:
    throw new Error(`bench for ${b.prover} not implemented`);
}
})
