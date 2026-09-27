export default (
    <style>
        {`

#hltb-for-deck{
    position: relative;
}

.hltb-info {
    background: var(--hltb-bar-bg, rgb(var(--hltb-bar-rgb, 14 20 27) / var(--hltb-bar-alpha, 0.25)));
    position: relative;
    border-bottom: var(--hltb-border-width, 2px) solid var(--hltb-border-color, rgba(61,68,80,.54));
    padding-top: var(--hltb-pad-y, 5px);
    color: var(--hltb-text-color, inherit);
    text-shadow: var(--hltb-text-shadow, none);
    border-radius: var(--hltb-radius, 0);
}

/* Keep the "Clean" layouts at 50% opacity unless the user overrides it. */
.hltb-info-clean-default,
.hltb-info-clean {
    --hltb-bar-alpha: 0.5;
}

.hltb-info-clean-default {
    position: absolute;
    border: 0;
    border-bottom: var(--hltb-border-width, 0) solid var(--hltb-border-color, rgba(61,68,80,.54));
    padding-top: 0px;
    top: calc(0px - var(--hltb-bar-height, 40px) * var(--hltb-text-scale, 1));
    height: calc(var(--hltb-bar-height, 40px) * var(--hltb-text-scale, 1));
    width: 100%;
}

.hltb-info-absolute {
    position: absolute;
    display: none;
}

.hltb-info-clean {
    position: absolute;
    top: var(--hltb-clean-top, -55vh);
    right: var(--hltb-clean-inset, 2.8vw);
    width: fit-content;
    height: fit-content;
    border: 0;
    border-bottom: var(--hltb-border-width, 0) solid var(--hltb-border-color, rgba(61,68,80,.54));
}

.hltb-info-clean-left {
    right: 0px;
    left: var(--hltb-clean-inset, 2.8vw);
}

.hltb-info ul {
    list-style: none;
    padding: var(--hltb-pad-y, 5px) var(--hltb-pad-x, 35px);
    margin: 0px;
    display: flex;
    flex: 0 1 auto;    
}

.hltb-info-clean ul {
    display: block;
    flex-direction: column;
}

.hltb-info ul li {
    text-align: center;
}

.hltb-info p {
    margin: 0;
}

.hltb-gametime {
    font-size: calc(var(--hltb-stat-size, 16px) * var(--hltb-text-scale, 1));
    font-weight: bold;
}

.hltb-info-clean .hltb-gametime {
    font-size: calc(var(--hltb-stat-size, 16px) * var(--hltb-stat-scale-clean, 1.25) * var(--hltb-text-scale, 1));
    font-weight: bold;
}

.hltb-label {
    text-transform: uppercase;
    font-size: calc(var(--hltb-label-size, 10px) * var(--hltb-text-scale, 1));
}
.hltb-details-btn {
    background: transparent !important;
    color: var(--hltb-link-color, #67c1f5) !important;
    margin: auto !important;
    font-size: 10px !important;
    font-weight: bold !important;
    text-transform: uppercase;
    line-height: 10px !important;
}
.hltb-details-btn-clean {
    margin: auto !important;
}

.hltb-details-btn:focus {
    color: var(--hltb-link-color-focus, #ffffff) !important;
}
.hltb-details-btn:hover {
    color: var(--hltb-link-color-focus, #ffffff) !important;
}
`}
    </style>
);
