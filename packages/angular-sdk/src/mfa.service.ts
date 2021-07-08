import { Inject, Injectable } from '@angular/core';
import { init, MFA } from 'kinvey-html5-sdk';
import { KinveyConfigToken } from './utils';

@Injectable({
  providedIn: 'root'
})

export class MFAService {
  constructor(@Inject(KinveyConfigToken) config: any) {
    init(config);
  }

  public readonly Authenticators: any = MFA.Authenticators;

  listRecoveryCodes() {
    return MFA.listRecoveryCodes();
  }

  regenerateRecoveryCodes() {
    return MFA.regenerateRecoveryCodes();
  }

  isEnabled() {
    return MFA.isEnabled();
  }

  disable() {
    return MFA.disable();
  }
}
