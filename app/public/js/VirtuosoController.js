class VirtuosoController {

    constructor() {

        this.trgUploadFilesEl = document.querySelector('#upload-trigger');
        this.inputFilesEl = document.querySelector('#files');
        this.progressBarEl = document.querySelector('#upload-progress');

        this.startEvents();

    }

    startEvents() {

        this.trgUploadFilesEl.addEventListener('click', event => {

            this.inputFilesEl.click();

        });

        this.inputFilesEl.addEventListener('change', event => {

            this.progressBarEl.style.display = 'block';

        });

    }
    
}