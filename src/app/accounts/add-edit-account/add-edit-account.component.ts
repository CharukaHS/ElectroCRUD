import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IAccount } from '../../../shared/interfaces/accounts.interface';
import { IIPCCheckConnectionResponseMessage } from '../../../shared/ipc/accounts.ipc';
import { AccountsIPCService } from '../../services/ipc/accounts.service';
import { remote } from 'electron';

export enum DatabaseConnectionType {
  SERVER,
  FILE
}

@Component({
  selector: 'app-add-edit-account',
  templateUrl: './add-edit-account.component.html',
  styleUrls: ['./add-edit-account.component.scss']
})
export class AddEditAccountComponent implements OnInit {

  title: string = "Add new account";
  accountId: number;
  editAccount: IAccount;

  isSaveEnabled: boolean = false;
  public testLog: [string, string][];

  basicDetailsForm: FormGroup;
  tunnelDetailsForm: FormGroup;
  databaseDetailsForm: FormGroup;
  databaseFileDetailsForm: FormGroup;
  databaseConnectionType: DatabaseConnectionType;
  DatabaseConnectionType = DatabaseConnectionType;

  databaseServers: any[] = [
    { name: 'MySQL', value: 1, port: 3306 },
    { name: 'Postgres', value: 3, port: 5432 },
    { name: 'SQLite3', value: 5 }
  ]

  constructor(
    public ref: NbDialogRef<any>,
    private fb: FormBuilder,
    private accountsIPCService: AccountsIPCService
  ) { 
    this.testLog = [];
  }

  get isEdit(): boolean {
    return this.accountId > 0;
  }

  ngOnInit() {
    console.log(this.ref);
    if (this.ref.componentRef.instance.account) {
      this.editAccount = this.ref.componentRef.instance.account;
      this.accountId = this.editAccount.id;
    }

    this.basicDetailsForm = this.fb.group({
      accountNameCtrl: [this.editAccount ? this.editAccount.name : null, Validators.compose([Validators.required, Validators.minLength(3)])],
      databaseServerCtrl: [this.editAccount ? String(this.editAccount.server.server_type) : null, Validators.required],
    });
    
    this.tunnelDetailsForm = this.fb.group({
      isTunnelEnabledCtrl: [this.editAccount ? this.editAccount.ssh.enabled : false, Validators.required],
      sshHostCtrl: [this.editAccount ? this.editAccount.ssh.hostname : null, Validators.required],
      sshPortCtrl: [this.editAccount ? this.editAccount.ssh.port : null, Validators.required],
      sshUsernameCtrl: [this.editAccount ? this.editAccount.ssh.username : null, Validators.required],
      sshPasswordCtrl: [this.editAccount ? this.editAccount.ssh.password : null, Validators.nullValidator],
      isSSHKeyEnabledCtrl: [this.editAccount ? this.editAccount.ssh.use_key : false, Validators.required],
      sshPrivateKeyCtrl: [this.editAccount ? this.editAccount.ssh.key : null],
    });

    this.databaseDetailsForm = this.fb.group({
      dbHostCtrl: [this.editAccount ? this.editAccount.server.hostname : null, Validators.required],
      dbPortCtrl: [this.editAccount ? this.editAccount.server.port : null, Validators.required],
      dbUsernameCtrl: [this.editAccount ? this.editAccount.server.username : null, Validators.required],
      dbPasswordCtrl: [this.editAccount ? this.editAccount.server.password : null, Validators.nullValidator],
      dbDbCtrl: [this.editAccount ? this.editAccount.server.database : null, Validators.required],
    });

    this.databaseFileDetailsForm  = this.fb.group({
      dbFilenameCtrl: [this.editAccount ? this.editAccount.file.filename : null, Validators.required],
    });

    this.basicDetailsForm.controls.databaseServerCtrl.valueChanges.subscribe((newVal) => {
      this.databaseConnectionType = (newVal == 5) ? DatabaseConnectionType.FILE : DatabaseConnectionType.SERVER;
      this.databaseServers.forEach((dbSrv) => {
        if (dbSrv.value == newVal) {
          if (dbSrv.port) {
            this.databaseDetailsForm.controls.dbPortCtrl.setValue(dbSrv.port);
          }
        }
      })
    })
    
    this.tunnelDetailsForm.controls.isTunnelEnabledCtrl.valueChanges.subscribe((newVal) => {
      ['sshHostCtrl', 'sshPortCtrl', 'sshUsernameCtrl', 'sshPasswordCtrl'].forEach((item) => {
        let ctrl = this.tunnelDetailsForm.controls[item];
        if (newVal) {
          ctrl.enable();
        } else {
          ctrl.disable();
        }
      })
    });

    this.tunnelDetailsForm.controls.isSSHKeyEnabledCtrl.valueChanges.subscribe((newVal) => {
      let passCtrl = this.tunnelDetailsForm.controls.sshPasswordCtrl;
      let keyCtrl = this.tunnelDetailsForm.controls.sshPrivateKeyCtrl
      if (newVal) {
        passCtrl.disable();
        keyCtrl.enable();
      } else {
        passCtrl.enable();
        keyCtrl.disable();
      }
    });

    this.tunnelDetailsForm.controls.isTunnelEnabledCtrl.updateValueAndValidity();

    if (this.isEdit) {
      this.title = `Edit Account: ${this.basicDetailsForm.controls['accountNameCtrl'].value}`;
    }
  }

  onBasicDetailsSubmit() {
    this.basicDetailsForm.markAsDirty();
  }

  onTunnelDetailsSubmit() {
    this.tunnelDetailsForm.markAsDirty();
  }

  onDatabaseDetailsSubmit() {
    this.databaseDetailsForm.markAsDirty();
  }

  get activeDatabaseDetailsForm(): FormGroup {
    if (this.databaseConnectionType == DatabaseConnectionType.FILE) {
      return this.databaseFileDetailsForm;
    }
    return this.databaseDetailsForm;
  }

  formAsAccount(): IAccount {
    const fromBasicForm = (ctrl: string) => this.basicDetailsForm.controls[ctrl].value;
    const fromTunnelForm = (ctrl: string) => this.tunnelDetailsForm.controls[ctrl].value;
    const fromDBForm = (ctrl: string) => this.databaseDetailsForm.controls[ctrl].value;
    const fromFileDBForm = (ctrl: string) => this.databaseFileDetailsForm.controls[ctrl].value;
    

    let obj:any = {
      id: this.editAccount ? this.editAccount.id : null,
      name: fromBasicForm('accountNameCtrl'),
      creation_date: this.editAccount ? this.editAccount.creation_date : new Date().toISOString(),
      modify_date: this.editAccount ? this.editAccount.modify_date : new Date().toISOString(),
      ssh: {
        enabled: fromTunnelForm('isTunnelEnabledCtrl'),
        hostname: fromTunnelForm('sshHostCtrl'),
        port: fromTunnelForm('sshPortCtrl'),
        username: fromTunnelForm('sshUsernameCtrl'),
        password: fromTunnelForm('sshPasswordCtrl'),
        use_key: fromTunnelForm('isSSHKeyEnabledCtrl'),
        key: fromTunnelForm('sshPrivateKeyCtrl')
      }
    };

    if (this.databaseConnectionType == DatabaseConnectionType.SERVER) {
      obj.server = {
        server_type: fromBasicForm('databaseServerCtrl'),
        hostname: fromDBForm('dbHostCtrl'),
        port: fromDBForm('dbPortCtrl'),
        username: fromDBForm('dbUsernameCtrl'),
        password: fromDBForm('dbPasswordCtrl'),
        database: fromDBForm('dbDbCtrl'),
      };
    }

    if (this.databaseConnectionType == DatabaseConnectionType.FILE) {
      obj.server = {
        server_type: fromBasicForm('databaseServerCtrl'),
        filename: fromFileDBForm('dbFilenameCtrl'),
      };
    }

    return obj;

  }

  async testConnection() {
    this.testLog = [];
    const res:IIPCCheckConnectionResponseMessage = await this.accountsIPCService.checkConnection(this.formAsAccount());
    this.isSaveEnabled = (this.formAsAccount().ssh.enabled) ? (res.ssh.valid && res.server.valid) : res.server.valid;
    if (this.formAsAccount().ssh.enabled) {
      if (res.ssh.valid) {
        this.testLog.push([`success`, `[OK] SSH`])
      } else {
        this.testLog.push([`danger`, `[FAIL] SSH, error: ${res.ssh.error}`]);
      }
    }
    if (res.server.valid) {
      this.testLog.push([`success`, `[OK] DATABASE`])
    } else {
      this.testLog.push([`danger`, `[FAIL] DATABASE,  error: ${res.server.error}`]);
    }
  }

  openElectronFileDialog(dstCtrl) {
    console.log(this.databaseFileDetailsForm)
    console.log()
    let fileRes:any = remote.dialog.showOpenDialogSync({
      properties: ['openFile', 'showHiddenFiles']
    });

    if (fileRes && fileRes[0]) {
      dstCtrl.setValue(fileRes[0]);
      //this.tunnelDetailsForm.controls.sshPrivateKeyCtrl.setValue(fileRes[0]);
    }
    console.log(fileRes);
  }
  
  save() {
    this.ref.close(this.formAsAccount());
  }
}
