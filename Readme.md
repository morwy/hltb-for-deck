# HLTB for Deck

## Description

A plugin to show you game lengths according to How Long To Beat.

Built with [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader).

> [!IMPORTANT]  
> Please note that HLTB does not have an official public API. This plugin (and this fork in particular) is heavily depending on the API changes discovered and implemented in [HowLongToBeat-PythonAPI repository](https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI). Every change done to API by HLTB might break this plugin workability. Unfortunately, there may and will be delays in restoring the plugin workability. However, recent changes were implemented to mitigate changes in the HLTB API and try to get the API name dynamically, bypassing the need for manual changes and a new version if possible.

> [!IMPORTANT]  
> This fork is not currently available in **Decky Store** because it was not authorized yet by the previous maintainer. Due to this users have to install releases manually. Please refer to the chapter **Manual installation in Decky** below.

## Features

- On an app page, shows four main stats offered by How Long to Beat
- Clicking **View Details** will take you to their site for the game
- Results are cached for two hours (cache can be cleared from QAM page for HLTB for Deck)

## Screenshots

![](images/image001.png)

## Manual installation in Decky

1. Proceed to **Decky Settings** &rarr; **General**.
2. Enable **Developer Mode**.
3. Then go to newly appeared **Developer** tab &rarr; **Install Plugin from ZIP File** and click **Browse**. Or you can try directly installing from via link by entering it to **Install Plugin from URL** text field.
4. Select the ZIP archive or enter following link: [https://github.com/morwy/hltb-for-deck/releases/latest/download/hltb-for-deck.zip](https://github.com/morwy/hltb-for-deck/releases/latest/download/hltb-for-deck.zip).
5. After installing go to **Plugins**.
6. Select **HLTB for Deck** settings and then click **Reload**.
7. **HLTB for Deck** plugin should change its version to latest one, indicating successful installation.

## New Features (as of 1.4.0)

### Customize visibility of plugin per game

![](images/image002.png)

On the game's page, click the gear icon and then Show/Hide HLTB Stats to toggle whether or not the plugin is displayed for the current game. This allows you to customize whether you want to see the stats for a game or not.

### Customize which stats are displayed

![](images/image003.png)
From the Quick Access Menu HLTB For Deck settings page, toggle each stat individually.
