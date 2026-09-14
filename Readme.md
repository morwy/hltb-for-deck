# HLTB for Deck

## Description

A plugin to show you game lengths according to How Long To Beat. Built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader).

Currently this is an actively maintained fork of [original HLTB for Deck plugin](https://github.com/hulkrelax/hltb-for-deck).
[hulkrelax](https://github.com/hulkrelax) is the original author of the plugin. Cheers and huge thanks to [safijari](https://github.com/safijari) / [SDH-Stewardship](https://github.com/SDH-Stewardship) for maintaining the plugin for a long time before this fork.

> [!IMPORTANT]  
> Please note that HLTB does not have an official public API. This plugin (and this fork in particular) is heavily depending on the API changes discovered and implemented in [HowLongToBeat-PythonAPI repository](https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI). Every change done to API by HLTB might break this plugin workability. Unfortunately, there may and will be delays in restoring the plugin workability. However, recent changes were implemented to mitigate changes in the HLTB API and try to get the API name dynamically, bypassing the need for manual changes and a new version if possible.

## Features

- On an app page, shows four main stats offered by How Long to Beat
- Clicking **View Details** will take you to their site for the game
- Results are cached for two hours (cache can be cleared from QAM page for HLTB for Deck)

## Screenshots

![Title image](images/image001.png)

## Manual installation in Decky

1. Proceed to **Decky Settings** &rarr; **General**.
2. Enable **Developer Mode**.
3. Then go to newly appeared **Developer** tab &rarr; **Install Plugin from ZIP File** and click **Browse**. Or you can try directly installing from via link by entering it to **Install Plugin from URL** text field.
4. Select the ZIP archive or enter following link: [https://github.com/morwy/hltb-for-deck/releases/latest/download/hltb-for-deck.zip](https://github.com/morwy/hltb-for-deck/releases/latest/download/hltb-for-deck.zip).
5. After installing go to **Plugins**.
6. Select **HLTB for Deck** settings and then click **Reload**.
7. **HLTB for Deck** plugin should change its version to latest one, indicating successful installation.

## Building from source

1. Download and install Node.js from [https://nodejs.org/en/download](https://nodejs.org/en/download).
2. Verify that installation was successful by running following command in terminal:

   ```bash
   node --version
   ```

3. Clone this repository and navigate to the project folder.
4. Install pnpm:

   ```bash
   npm install -g pnpm
   ```

5. Install project dependencies:

   ```bash
   pnpm install
   ```

6. Build the project:

   ```bash
   pnpm run build
   ```

A batch script `build.bat` that builds and packs the project into a ZIP archive for manual installation was created and located in the project root folder.

## Submitting update to Decky Plugin Database

1. Create a fork of [Decky Plugin Database repository](https://github.com/SteamDeckHomebrew/decky-plugin-database).
2. Checkout it locally. I suggest skipping the recursive checkout of submodules, because it may take forever.

   ```bash
   git clone https://github.com/morwy/decky-plugin-database.git
   ```

3. Verify that you are on the `main` branch.

   ```bash
   git checkout main
   ```

4. Create a new branch that contains the latest update from the plugin.

   ```bash
   git checkout -b update/hltb-2.0.10
   ```

5. Initialize the plugin submodule **if it is a fresh clone of the repository and there are no files in the folder**.

   ```bash
   git submodule update --init plugins\hltb-for-deck
   ```

6. Update the plugin submodule to the latest commit.

   ```bash
   cd plugins/hltb-for-deck && git checkout main && git pull && cd ../..
   ```

7. Add and commit your changes to the Git.

   ```bash
   git add plugins/hltb-for-deck && git commit -m "Updated hltb-for-deck to 2.0.10" && git push --set-upstream origin update/hltb-2.0.10
   ```

8. After new changes have landed on the GitHub, click on **Compare & pull request** button in your forked repository. It will automatically open a form for filling in the PR to the original repository.
9. Use correct form template and continue according to the provided instructions.
