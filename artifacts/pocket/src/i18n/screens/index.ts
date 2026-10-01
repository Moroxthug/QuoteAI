// One file of strings per screen so each can be built on its own; en.ts / fr.ts spread these in.
import * as common from "./common";
import * as companyPicker from "./companyPicker";
import * as firstQuote from "./firstQuote";
import * as forgot from "./forgot";
import * as home from "./home";
import * as widgets from "./widgets";
import * as clients from "./clients";
import * as invites from "./invites";
import * as quotes from "./quotes";
import * as menu from "./menu";
import * as joinCode from "./joinCode";
import * as onboarding from "./onboarding";
import * as signIn from "./signIn";
import * as signUp from "./signUp";
import * as twoStep from "./twoStep";
import * as verify from "./verify";
import * as welcome from "./welcome";

export const screensEn = { ...common.en, welcome: welcome.en, signIn: signIn.en, signUp: signUp.en, verify: verify.en, twoStep: twoStep.en, forgot: forgot.en, invites: invites.en, joinCode: joinCode.en, companyPicker: companyPicker.en, onboarding: onboarding.en, firstQuote: firstQuote.en, menu: menu.en, quotes: quotes.en, home: home.en, widgets: widgets.en, clients: clients.en };
export const screensFr = { ...common.fr, welcome: welcome.fr, signIn: signIn.fr, signUp: signUp.fr, verify: verify.fr, twoStep: twoStep.fr, forgot: forgot.fr, invites: invites.fr, joinCode: joinCode.fr, companyPicker: companyPicker.fr, onboarding: onboarding.fr, firstQuote: firstQuote.fr, menu: menu.fr, quotes: quotes.fr, home: home.fr, widgets: widgets.fr, clients: clients.fr };
