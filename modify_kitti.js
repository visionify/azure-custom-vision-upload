const fs = require('fs')

async function main(){
    let sampleDataRoot = '/home/abhian/Documents/samplekitti/'
    var filesArray = fs.readdirSync(sampleDataRoot).filter(file => fs.lstatSync(sampleDataRoot + file).isFile())
    for(let file of filesArray){
        console.log(file)
        await processFile(sampleDataRoot+file)
    }
}

async function processFile(file){
    var contents = fs.readFileSync(file, 'utf8');
    console.log(contents)
    contents = contents
    .split('\n')
    .map(row=>row.split(' ').slice(0, -1).join(' '))
    .join('\n')
    console.log(contents)
    fs.writeFileSync(file,contents)
}


main()