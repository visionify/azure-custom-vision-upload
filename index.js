const util = require('util');
const fs = require('fs');
const TrainingApi = require("@azure/cognitiveservices-customvision-training");
const PredictionApi = require("@azure/cognitiveservices-customvision-prediction");
const msRest = require("@azure/ms-rest-js");
var xml2json = require('xml2js');
var parser = new xml2json.Parser();
// const { promises: { readdir } } = require('fs')
const readdir = fs.promises.readdir
const setTimeoutPromise = util.promisify(setTimeout);

let cs_training_key = "c11254eb0af647f29aa3c7f4c8c2193e"
let cs_training_endpoint = "https://oos-shelf-detection.cognitiveservices.azure.com/"
let my_training_key = "843152cfc1eb45e9aeac3308398b9b67"
let my_training_endpoint = "https://mltrainingtest.cognitiveservices.azure.com/"

//CONFIGURATIONS : Update these values
const trainingKey = cs_training_key;
const trainingEndpoint = cs_training_endpoint;
const predictionKey = "24ddfbfed63f4d97abc89a88c3d0798a"; //
const predictionResourceId = "/subscriptions/14ef0c4c-a76e-442f-bfa9-d986d43b5f25/resourceGroups/ml-training/providers/Microsoft.CognitiveServices/accounts/mltrainingtest-Prediction";
const predictionEndpoint = "https://mltrainingtest-prediction.cognitiveservices.azure.com/";
const trainingProjectName = 'Shelf Detection - Gen1'
const publishIterationName = "detectModel";

const credentials = new msRest.ApiKeyCredentials({ inHeader: { "Training-key": trainingKey } });
const trainer = new TrainingApi.TrainingAPIClient(credentials, trainingEndpoint);
const predictor_credentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
const predictor = new PredictionApi.PredictionAPIClient(predictor_credentials, predictionEndpoint);

async function main({ projectIdToDelete, projectId, options }) {

    let currentProject
    await deleteProject(projectIdToDelete)
    currentProject = await createNewProject(projectId)

    for (let option of options) {
        let customTag = await getCustomTag(currentProject.id, option.tagName)
        if (option.type == 'GEN1') {
            let folders = await getFoldersFromGen1RootFolder(option.url)
            console.log(folders)
            console.log(option.tagName)
            for (let folder of folders) {
                await uploadAllImageFromAFolderWithOnlyImage(folder, customTag, currentProject)
            }
        } else if (option.type == 'GEN2') {
            console.log('STILL NEED TO BE CODED FOR GEN2')
        } else {
            await uploadAllImageFromAFolderWithOnlyImage(option.url, customTag, currentProject)
        }
    }
}


async function getCustomTag(projectId, tagName) {
    let customTags = await trainer.getTags(projectId)
    let customTag = customTags.find(t => t.name == tagName)
    if (customTag) {
        return await trainer.getTag(projectId, customTag.id)
    } else {
        return await trainer.createTag(projectId, tagName);
    }
}

async function deleteProject(project) {
    if (!project)
        return
    else if (project === 'ALL') {
        let projects = await trainer.getProjects()
        for (let project of projects) {
            await trainer.deleteProject(project.id)
        }
    } else {
        try {
            await trainer.deleteProject(project.id)
        } catch (e) {
            console.error('Unable to delete projectb :: ', project.id)
        }
    }
}

async function createNewProject(projectId) {
    if (projectId === 'NEW' || !projectId) {
        const domains = await trainer.getDomains()
        const objDetectDomain = domains.find(domain => domain.type === "ObjectDetection")
        let project = await trainer.createProject(trainingProjectName, { domainId: objDetectDomain.id });
        if (!project) {
            throw new Error('COULD NOT FIND PROJECT')
        } else {
            return project
        }
    } else {
        try {
            return await trainer.getProject(projectId)
        } catch (e) {
            console.error('We could not find the projectId :: ', projectId)
            throw new Error('COULD NOT FIND PROJECT')
        }
    }
}

async function getFoldersFromGen1RootFolder(baseFolder) {
    let result = []
    let folders = (await readdir(baseFolder, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

    for (let folder of folders) {
        let tempAddress = `${baseFolder}/${folder}`
        let subfolders = (await readdir(tempAddress, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
        // console.log(subfolders)
        for (let subfolder of subfolders) {
            let sourceFolder = `${baseFolder}/${folder}/${subfolder}/output-shelf-images-${folder}-${subfolder}/input-shelf-images-${folder}-${subfolder}`
            result.push(sourceFolder)
        }
    }
    return result
}


async function uploadAllImageFromAFolderWithOnlyImage(sampleDataRoot, customTag, sampleProject) {
    sampleDataRoot += '/'
    let erroredFolders = []
    let erroredFiles = []

    try {
        var filesArray = fs.readdirSync(sampleDataRoot).filter(file => fs.lstatSync(sampleDataRoot + file).isFile())
    } catch (e) {
        erroredFolders.push(sampleDataRoot)
    }
    filesArray = filesArray || []
    filesArray = filesArray.filter(a => a.split('.')[1] === 'jpg')
    let entries = []
    for (let file of filesArray) {
        file = file.split('.')[0]
        try {
            var contents = fs.readFileSync(sampleDataRoot + file + '.xml', 'utf8');
        } catch (e) {
            erroredFiles.push(sampleDataRoot + file + '.xml')
            continue
        }
        let result = await parser.parseStringPromise(contents)
        let size = result.annotation.size[0]
        result = result.annotation.object
        if (!result) {
            erroredFiles.push(sampleDataRoot + file + '.xml')
            continue
        }

        const img_contents = fs.readFileSync(`${sampleDataRoot}${file}.jpg`);
        const entry = {
            name: file,
            contents: img_contents,
            regions: result.map(i => {
                let region = i.bndbox
                let left = (region[0].xmin)[0] / size.width[0]
                let bot = (region[0].ymax)[0] / size.height[0]
                let right = (region[0].xmax)[0] / size.width[0]
                let top = (region[0].ymin)[0] / size.height[0]
                return {
                    tagId: customTag.id,
                    left: +left,
                    top: +top,
                    width: Math.abs(right - left),
                    height: Math.abs(top - bot),
                }

            })
        }
        entries.push(entry)
    }
    let batchChunks = splitToBulks(entries, 64)
    for (let chunk of batchChunks) {
        const batch = { images: chunk };
        await setTimeoutPromise(1000, null);
        let uploadResult = await trainer.createImagesFromFiles(sampleProject.id, batch)
        if (uploadResult && uploadResult.images) {
            console.log(uploadResult.images.map(i => i.status))
        }
    }
    console.log('Completed upload of all iamges from :: ', sampleDataRoot)
    return { erroredFolders, erroredFiles }
}

function splitToBulks(arr, bulkSize = 20) {
    const bulks = [];
    for (let i = 0; i < Math.ceil(arr.length / bulkSize); i++) {
        bulks.push(arr.slice(i * bulkSize, (i + 1) * bulkSize));
    }
    return bulks;
}


main({
    projectIdToDelete: null,
    projectId: null,
    options: [
        {
            url: '/data/tao_samples/shelf-images-dataset-copy/gen1_frozenfood/shelf-tagging',
            type: 'GEN1',
            tagName: 'Frozenfood'
        },
        {
            url: '/data/tao_samples/shelf-images-dataset-copy/gen1_alcohol/shelf_training',
            type: 'GEN1',
            tagName: 'Alcohol'
        },
        {
            url: '/data/tao_samples/shelf-images-dataset-copy/gen1_dairymeat',
            type: 'GEN1',
            tagName: 'Dairymeat'
        },
        {
            url: '/data/tao_samples/shelf-images-dataset-copy/gen1_beverages1',
            type: 'GEN1',
            tagName: 'Beverage'
        },
        {
            url: '/data/tao_samples/shelf-images-dataset-copy/gen1_icecream/shelf-tagging',
            type: 'GEN1',
            tagName: 'Icecream'
        },
    ]
})

// to unzip everything recursively inside a fodler ---->  find . -iname '*.zip' -exec sh -c 'unzip -o -d "${0%.*}" "$0"' '{}' ';'
