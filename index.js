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

let cs_training_key = "24ddfbfed63f4d97abc89a88c3d0798a"
let cs_training_endpoint = "https://oos-object-detection-beverages.cognitiveservices.azure.com/"
let my_training_key = "843152cfc1eb45e9aeac3308398b9b67"
let my_training_endpoint = "https://mltrainingtest.cognitiveservices.azure.com/"

//CONFIGURATIONS : Update these values
const trainingKey = my_training_key;
const trainingEndpoint = my_training_endpoint;
const predictionKey = "24ddfbfed63f4d97abc89a88c3d0798a"; //
const predictionResourceId = "/subscriptions/14ef0c4c-a76e-442f-bfa9-d986d43b5f25/resourceGroups/ml-training/providers/Microsoft.CognitiveServices/accounts/mltrainingtest-Prediction";
const predictionEndpoint = "https://mltrainingtest-prediction.cognitiveservices.azure.com/";
const trainingProjectName = 'Shelf Detection - Gen1'
const publishIterationName = "detectModel";

const credentials = new msRest.ApiKeyCredentials({ inHeader: { "Training-key": trainingKey } });
const trainer = new TrainingApi.TrainingAPIClient(credentials, trainingEndpoint);
const predictor_credentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
const predictor = new PredictionApi.PredictionAPIClient(predictor_credentials, predictionEndpoint);


async function main({ deletePreviousProject, createNewProject, prevProjectId, tagName, rootFolder }) {
    let sampleProject
    if (deletePreviousProject) {
        let projects = await trainer.getProjects()
        for (let project of projects) {
            try {
                await trainer.deleteProject(project.id)
            } catch (e) {
                console.error('error while deleting prev projects :: ', e)
            }
        }

    }

    if (createNewProject) {
        console.log("Creating project...");
        const domains = await trainer.getDomains()
        console.log('________________________________________DOMAIN', domains)
        const objDetectDomain = domains.find(domain => domain.type === "ObjectDetection")
        sampleProject = await trainer.createProject(trainingProjectName, { domainId: objDetectDomain.id });
    } else {
        try {
            sampleProject = await trainer.getProject(prevProjectId)
        } catch (e) {
            console.log(e)
            throw new Error('Could not find the project. If you dont have a project ID. you can delete previous projects and create a new one')
        }
    }


    const baseFolder = rootFolder


    // Get tag if exists or create a new tag
    console.log("Sample project ID: " + sampleProject.id);
    let customTag
    const customTags = await trainer.getTags(prevProjectId)
    customTag = customTags.find(t => t.name == tagName)
    if (customTag) {
        customTag = await trainer.getTag(prevProjectId, customTag.id)
    } else {
        customTag = await trainer.createTag(sampleProject.id, tagName);
    }


    let folders = (await readdir(baseFolder, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

    for (let folder of folders) {
        let tempAddress = `${baseFolder}/${folder}`
        let subfolders = (await readdir(tempAddress, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
        console.log(subfolders)
        for (let subfolder of subfolders) {
            let sourceFolder = `${baseFolder}/${folder}/${subfolder}/output-shelf-images-${folder}-${subfolder}/input-shelf-images-${folder}-${subfolder}/`
            try {
                await uploadAllImageFromAFolderWithOnlyImage(sourceFolder, customTag, sampleProject)
            } catch (e) {
                console.error(e, 'sourceFolder :: ', sourceFolder)
            }
        }
    }
}


async function uploadAllImageFromAFolderWithOnlyImage(sampleDataRoot, customTag, sampleProject) {
    let filesArray = fs.readdirSync(sampleDataRoot).filter(file => fs.lstatSync(sampleDataRoot + file).isFile())
    filesArray = filesArray.filter(a => a.split('.')[1] === 'jpg')
    let fileUploadPromises = [];
    let entries = []
    for (let file of filesArray) {
        file = file.split('.')[0]
        var contents = fs.readFileSync(sampleDataRoot + file + '.xml', 'utf8');
        let result = await parser.parseStringPromise(contents)
        let size = result.annotation.size[0]
        result = result.annotation.object
        if (!result) {
            console.log('There was some issue with the annotation for :: ', sampleDataRoot + file)
            console.log('continuing to the next image')
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
                let top = (region[0].ymin)[0] / size.width[0]
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
    const batch = { images: entries };
    await setTimeoutPromise(1000, null);
    fileUploadPromises.push(trainer.createImagesFromFiles(sampleProject.id, batch));
    let uploadResult = await Promise.all(fileUploadPromises);
    console.log(uploadResult[0])
    console.log('Completed upload of all iamges from :: ', sampleDataRoot)
}


main({
    // deletePreviousProject: false,
    prevProjectId: 'a63788ca-6fb1-4920-8de6-2cf54e563c5a',
    // deletePreviousProject: true,
    rootFolder: '/data/tao_samples/shelf-images-dataset-copy/gen1_dairymeat',
    // createNewProject: true,
    tagName: 'Dairymeat'
})





// to unzip everything recursively inside a fodler ---->  find . -iname '*.zip' -exec sh -c 'unzip -o -d "${0%.*}" "$0"' '{}' ';'
