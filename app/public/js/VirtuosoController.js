class VirtuosoController {

    constructor() {

        this.currentFolder = ['All'];
        this.onSelectionChange = new Event('selectionchange');

        this.navEl = document.querySelector('#nav-breadcrumb');
        this.trgUploadFilesEl = document.querySelector('#upload-trigger');
        this.trgNewFolderEl = document.querySelector('#new-folder-trigger');
        this.trgDownloadFilesEl = document.querySelector('#download-trigger');
        this.trgRenameEl = document.querySelector('#rename-trigger');
        this.trgDeleteEl = document.querySelector('#delete-trigger');
        this.inputFilesEl = document.querySelector('#files');
        this.uploadProgressBarEl = document.querySelector('#upload-progress');
        this.progressBarFgEl = this.uploadProgressBarEl.querySelector('.progress-fg');
        this.timeleftEl = this.uploadProgressBarEl.querySelector('.timeleft');
        this.listFilesEl = document.querySelector('#table-files tbody');

        this.connectFirebase();
        this.startEvents();
        this.openFolder();

    }

    getSelection() {

        return this.listFilesEl.querySelectorAll('.selected');

    }

    removeFile(ref, name) {

        let fileRef = firebase.storage().ref(ref).child(name);

        return fileRef.delete();

    }

    getFileIconView(file) {

        switch (file.type) {

            case 'folder':
                return `<td><img src="images/icons/folder.svg" height="30px" width="30px" /></td>`;

            case 'image/jpeg':
            case 'image/jpg':
            case 'image/png':
            case 'image/gif':

                return `<td><img src="images/icons/image.svg" height="30px" width="30px" /></td>`;

            case 'application/pdf':

                return `<td><img src="images/icons/pdf.svg" height="30px" width="30px" /></td>`;

            case 'audio/mp3':
            case 'audio/ogg':

                return `<td><img src="images/icons/audio.svg" height="30px" width="30px" /></td>`;

            case 'video/mp4':
            case 'video/quicktime':

                return `<td><img src="images/icons/audio.svg" height="30px" width="30px" /></td>`;

            default:

                return `<td><img src="images/icons/default.svg" height="30px" width="30px" /></td>`;

        }
    }

    formatSize(size) {

        if (!size) return '';

        if (size > 1024 * 1024 * 1024) return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';

        if (size > 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';

        if (size > 1024) return (size / 1024).toFixed(2) + ' kB';


    }

    getFileView(file, key) {

        let tr = document.createElement('tr');
        tr.dataset.key = key;
        tr.dataset.file = JSON.stringify(file);
        tr.innerHTML = `${this.getFileIconView(file)}<td>${file.name}</td><td>${this.formatSize(file.size)}</td>`;

        this.startEventsTr(tr);

        return tr;
    }

    startEventsTr(tr) {

        tr.addEventListener('dblclick', e => {

            let file = JSON.parse(tr.dataset.file);

            switch (file.type) {

                case 'folder':
                    this.currentFolder.push(file.name);
                    this.openFolder();
                    break;
                default:
                    firebase.storage().ref(file.path).getDownloadURL().then(url => {

                        window.open(url);

                    }).catch(err => {

                        console.error(err);

                    })

            }

        });

        tr.addEventListener('click', e => {

            if (e.shiftKey) {

                let firstTr = this.listFilesEl.querySelector('.selected');

                if (firstTr) {

                    let indexStart;
                    let indexEnd;
                    let trs = tr.parentElement.childNodes;

                    trs.forEach((el, index) => {

                        if (firstTr === el) indexStart = index;

                        if (tr === el) indexEnd = index;

                    });

                    let index = [indexStart, indexEnd].sort();

                    trs.forEach((el, i) => {

                        if (i >= index[0] && i <= index[1]) {
                            el.classList.add('selected');
                        }

                    });

                    this.listFilesEl.dispatchEvent(this.onSelectionChange);

                    return true;

                }

            }

            if (!e.ctrlKey) {

                this.listFilesEl.querySelectorAll('tr.selected').forEach(el => {

                    el.classList.remove('selected');

                });

            }

            tr.classList.toggle('selected');

            this.listFilesEl.dispatchEvent(this.onSelectionChange);

        });
    }

    connectFirebase() {
        var firebaseConfig = {
            apiKey: "AIzaSyB5VdR4MPASy-SOzkQKoJoaexYJu4FOCTY",
            authDomain: "virtuoso-drive.firebaseapp.com",
            databaseURL: "https://virtuoso-drive.firebaseio.com",
            projectId: "virtuoso-drive",
            storageBucket: "virtuoso-drive.appspot.com",
            messagingSenderId: "339048037266",
            appId: "1:339048037266:web:b9bf9c5268db372a"
        };

        firebase.initializeApp(firebaseConfig);
    }

    removeFolderTask(ref, name) {

        return new Promise((resolve, reject) => {

            let folderRef = this.getFirebaseRef(ref + '/' + name);

            folderRef.on('value', snapshot => {

                snapshot.forEach(item => {

                    let data = item.val();
                    data.key = item.key;

                    if (data.type === 'folder') {

                        this.removeFolderTask(ref + '/' + name, data.name).then(() => {

                            resolve({
                                fields: {
                                    key: data.key
                                }
                            });

                        }).catch(err => {

                            reject(err);

                        });

                    } else if (data.type) {

                        this.removeFile(ref + '/' + name, data.name).then(() => {

                            resolve({
                                fields: {
                                    key: data.key
                                }
                            });

                        }).catch(err => {

                            reject(err);

                        });

                    }

                });

                folderRef.remove();
                folderRef.off('value');
            });

        });

    }

    removeTask() {

        let promises = [];

        this.getSelection().forEach(tr => {

            let file = JSON.parse(tr.dataset.file);
            let key = tr.dataset.key;

            promises.push(new Promise((resolve, reject) => {

                if (file.type === 'folder') {

                    this.removeFolderTask(this.currentFolder.join('/'), file.name).then(() => {

                        resolve({
                            fields: {
                                key
                            }
                        });

                    });

                } else if (file.type) {

                    let name = file.path.split('/')[file.path.split('/').length - 1];

                    this.removeFile(this.currentFolder.join('/'), name).then(() => {

                        resolve({
                            fields: {
                                key
                            }
                        });

                    });

                }

            }));

        });

        return Promise.all(promises);

    }

    startEvents() {

        this.trgUploadFilesEl.addEventListener('click', event => {

            this.inputFilesEl.click();

        });

        this.inputFilesEl.addEventListener('change', event => {

            this.uploadTask(event.target.files).then(responses => {

                responses.forEach(resp => {

                    this.getFirebaseRef().push().set({
                        name: resp.name,
                        type: resp.contentType,
                        path: resp.fullPath,
                        size: resp.size
                    });

                });

                this.uploadComplete();

            }).catch(err => {

                this.uploadComplete();
                console.error(err);

            });

            this.showProgress();

            this.inputFilesEl.value = '';

        });

        this.listFilesEl.addEventListener('selectionchange', e => {

            switch (this.getSelection().length) {

                case 0:
                    this.trgDownloadFilesEl.style.display = 'none';
                    this.trgRenameEl.style.display = 'none';
                    this.trgDeleteEl.style.display = 'none';
                    break;

                case 1:
                    this.trgDownloadFilesEl.style.display = 'flex';
                    this.trgRenameEl.style.display = 'flex';
                    this.trgDeleteEl.style.display = 'flex';
                    break;

                default:
                    this.trgDownloadFilesEl.style.display = 'flex';
                    this.trgRenameEl.style.display = 'none';
                    this.trgDeleteEl.style.display = 'flex';

            }

        });

        this.trgRenameEl.addEventListener('click', e => {

            let tr = this.getSelection()[0];
            let file = JSON.parse(tr.dataset.file);

            let name = prompt("Rename file:", file.name);

            if (name) {

                file.name = name;

                this.getFirebaseRef().child(tr.dataset.key).set(file);

            }

        });

        this.trgDeleteEl.addEventListener('click', e => {

            this.removeTask().then(responses => {

                responses.forEach(response => {

                    if (response.fields.key) {

                        this.getFirebaseRef().child(response.fields.key).remove();
                    }

                });

            }).catch(err => {

                console.error(err);

            });

        });

        this.trgNewFolderEl.addEventListener('click', e => {

            let name = prompt("Name:");

            if (name) {

                this.getFirebaseRef().push().set({
                    name,
                    type: 'folder',
                    path: this.currentFolder.join('/')
                });

                this.listFilesEl.dispatchEvent(this.onSelectionChange);

            }

        });

    }

    uploadTask(files) {

        let promises = [];

        [...files].forEach(file => {

            promises.push(new Promise((resolve, reject) => {

                let fileRef = firebase.storage().ref(this.currentFolder.join('/')).child(file.name);

                let task = fileRef.put(file);

                task.on('state_changed', snapshot => {

                    this.uploadProgress({
                        loaded: snapshot.bytesTransferred,
                        total: snapshot.totalBytes
                    }, file);

                }, error => {

                    console.error(error);
                    reject(error);

                }, () => {

                    fileRef.getMetadata().then(metadata => {

                        resolve(metadata);

                    }).catch(err => {

                        reject(err);

                    })

                });

            }));

        });

        return Promise.all(promises);

    }

    uploadProgress(event, file) {

        let timeSpent = Date.now() - this.startUploadTime;
        let loaded = event.loaded;
        let total = event.total;
        let porcent = parseInt((loaded / total) * 100);
        let timeLeft = ((100 - porcent) * timeSpent) / porcent;

        this.progressBarFgEl.style.width = `${porcent}%`;
        this.timeleftEl.innerHTML = this.formatTimeToHuman(timeLeft);

    }

    formatTimeToHuman(duration) {

        let seconds = parseInt((duration / 1000) % 60);
        let minutes = parseInt((duration / (1000 * 60)) % 60);
        let hours = parseInt((duration / (1000 * 60 * 60)) % 24);

        if (hours > 0) {
            return `${hours} hours, ${minutes} minutes and ${seconds} seconds left`;
        }

        if (minutes > 0) {
            return ` - ${minutes} minutes and ${seconds} seconds left`;
        }

        if (seconds > 0) {
            return ` - ${seconds} seconds left`;
        }

        return '';

    }

    showProgress(show = true) {

        this.uploadProgressBarEl.style.display = (show) ? 'block' : 'none';

    }

    uploadComplete() {

        this.showProgress(false);
        this.inputFilesEl.value = '';

    }

    getFirebaseRef(path) {

        if (!path) path = this.currentFolder.join('/');

        return firebase.database().ref(path);

    }

    openFolder() {

        if (this.lastFolder) this.getFirebaseRef(this.lastFolder).off('value');

        this.clearSelection();
        this.renderNav();
        this.readFiles();

    }

    clearSelection() {

        let selections = this.getSelection();

        selections.forEach(selection => {

            if (selection.classList.contains('selected')) {
                selection.classList.remove('selected');
            };

        });

        this.listFilesEl.dispatchEvent(this.onSelectionChange);


    }

    readFiles() {

        this.lastFolder = this.currentFolder.join('/');

        this.getFirebaseRef().on('value', snapshot => {

            this.listFilesEl.innerHTML = '';

            snapshot.forEach(snapshotItem => {

                let key = snapshotItem.key;
                let data = snapshotItem.val();

                if (data.type) {
                    this.listFilesEl.appendChild(this.getFileView(data, key));
                }

            });

        });

    }

    renderNav() {

        let nav = document.createElement('nav');
        let ol = document.createElement('ol');
        ol.className = 'breadcrumb';
        nav.appendChild(ol);
        let path = [];

        for (let i = 0; i < this.currentFolder.length; i++) {

            let folderName = this.currentFolder[i];
            let li = document.createElement('li');

            path.push(folderName);

            if (i + 1 === this.currentFolder.length) {

                li.className = 'breadcrumb-item active';
                li.innerHTML = folderName;

            } else {

                li.className = 'breadcrumb-item';
                li.innerHTML = `<a href="#" data-path="${path.join('/')}">${folderName}</a>`;

            }

            ol.appendChild(li);

        }

        this.navEl.innerHTML = nav.innerHTML;

        this.navEl.querySelectorAll('a').forEach(a => {

            a.addEventListener('click', e => {

                e.preventDefault();

                this.currentFolder = a.dataset.path.split('/');

                this.openFolder();
            });
        });

    }

}