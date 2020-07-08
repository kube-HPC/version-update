const YAWN = require('yawn-yaml/cjs')
const request = require('request-promise');
const jsYaml = require('js-yaml');
const fs = require('fs');
const promisify = require('util').promisify;

const latestUrl = 'https://github.com/kube-HPC/release-manager/releases/latest'
const valuesYamlPath = process.env.VALUES_YAML_PATH 
const newValuesYamlPath = process.env.NEW_VALUES_YAML_PATH 
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const main = async () => {
    if (!valuesYamlPath || !newValuesYamlPath){
        console.error('Please set VALUES_YAML_PATH and NEW_VALUES_YAML_PATH env variables');
        process.exit(-1);
    }
    const latest = await request.get({
        url: latestUrl,
        headers: {
            Accept: 'application/json',
        },
        json: true

    });

    const latestTag = latest.tag_name;
    console.log(latestTag);
    const versionsYaml = await request({
        url: `https://github.com/kube-HPC/release-manager/releases/download/${latestTag}/version.yaml`
    });
    const versions = jsYaml.safeLoad(versionsYaml);
    console.log('System version: ', versions.systemversion);
    const valuesYaml = await readFile(valuesYamlPath, 'utf8');
    // const values = jsYaml.safeLoad(valuesYaml);
    const valuesObject = new YAWN(valuesYaml);
    const values = valuesObject.json;
    values.systemversion = versions.systemversion;
    values.fullSystemVersion = versions.fullSystemVersion;
    Object.keys(values).forEach(i => {
        if (values[i].image) {
            if (values[i].image.repository) {
                const service = values[i].image.repository.split('/')[1];
                const version = versions[service];
                if (version && version.image && version.image.tag) {
                    console.log(`service: ${i}, repo: ${service}:${version.image.tag}`);
                    values[i].image.tag = version.image.tag;
                }
                else {
                    console.log(`service: ${i}, version not found`);
                }

            }
        }
    })
    valuesObject.json=values
    const newVersionsYaml = valuesObject.yaml;
    await writeFile(newValuesYamlPath,newVersionsYaml);
};


main();