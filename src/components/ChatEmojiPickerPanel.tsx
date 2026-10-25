import type { UIEvent } from "react";
import type { StickerDTO, StickerAssetDTO } from "../types";
import { useI18n, type TranslationKey } from "../lib/language";
import { EMOJI_PAGES } from "../lib/composerEmojis";
import { resolveStableResourceUri } from "../lib/stableResource";
import { FeatureDiscoveryTarget } from "../lib/featureDiscovery";
import { StickerImage } from "./StickerImage";
import { UserAvatar } from "./UserAvatar";

interface Props {
  emojiPage:number; setEmojiPage:(page:number)=>void; visibleEmojis:readonly string[];
  stickers:StickerDTO[]; exploreStickers:StickerAssetDTO[]; frequentExploreStickerIds:number[];
  stickerSaving:boolean; mineStickersLoading:boolean; exploreStickersLoading:boolean;
  sendSticker:(sticker:StickerDTO|StickerAssetDTO)=>void|Promise<void>;
  collectExploredSticker?:(sticker:StickerAssetDTO)=>void|Promise<void>;
  openStickerManager?:()=>void;
  handleStickerGridScroll?:(event:UIEvent<HTMLDivElement>,kind:"mine"|"explore")=>void;
  insertEmoji:(emoji:string)=>void;
}
const STICKER_MY_PAGE=-2;
const STICKER_EXPLORE_PAGE=-1;
export function ChatEmojiPickerPanel({emojiPage,setEmojiPage,visibleEmojis,stickers,exploreStickers,frequentExploreStickerIds,stickerSaving,mineStickersLoading,exploreStickersLoading,sendSticker,collectExploredSticker,openStickerManager,handleStickerGridScroll,insertEmoji}:Props) {
  const { t }=useI18n();
  return (                  <div className="composer-emoji-panel" aria-label={t("emoji.picker")}>
                    <div className="composer-emoji-tabs" role="tablist" aria-label={t("emoji.categories")}>
                      <button
                        aria-label={t("sticker.mine")}
                        aria-selected={emojiPage === STICKER_MY_PAGE}
                        className={emojiPage === STICKER_MY_PAGE ? "is-active" : ""}
                        onClick={() => setEmojiPage(STICKER_MY_PAGE)}
                        role="tab"
                        title={t("sticker.mine")}
                        type="button"
                      >
                        <span className="material-symbols-outlined">photo_library</span>
                        <small>{t("sticker.mine")}</small>
                      </button>
                      <button
                        aria-label={t("sticker.explore")}
                        aria-selected={emojiPage === STICKER_EXPLORE_PAGE}
                        className={emojiPage === STICKER_EXPLORE_PAGE ? "is-active" : ""}
                        onClick={() => setEmojiPage(STICKER_EXPLORE_PAGE)}
                        role="tab"
                        title={t("sticker.explore")}
                        type="button"
                      >
                        <span className="material-symbols-outlined">explore</span>
                        <small>{t("sticker.explore")}</small>
                      </button>
                      {EMOJI_PAGES.map((page, index) => (
                        <button
                          aria-label={t(page.labelKey as TranslationKey)}
                          aria-selected={emojiPage === index}
                          className={emojiPage === index ? "is-active" : ""}
                          key={page.labelKey}
                          onClick={() => setEmojiPage(index)}
                          role="tab"
                          title={t(page.labelKey as TranslationKey)}
                          type="button"
                        >
                          <span>{page.icon}</span>
                          <small>{t(page.labelKey as TranslationKey)}</small>
                        </button>
                      ))}
                    </div>
                    {emojiPage === STICKER_MY_PAGE ? (
                      <div className="composer-sticker-pane" role="tabpanel" aria-label={t("sticker.mine")}>
                        {stickers.length ? (
                          <div className="composer-sticker-grid" onScroll={(event) => handleStickerGridScroll?.(event, "mine")}>
                            {openStickerManager ? <FeatureDiscoveryTarget className="is-sticker-entry" rewardId="capability.sticker">
                              <button className="composer-sticker-add is-manager-entry" disabled={stickerSaving} onClick={openStickerManager} type="button">
                                <span className="material-symbols-outlined">add</span>
                              </button>
                            </FeatureDiscoveryTarget> : null}
                            {stickers.map((sticker) => (
                              <button
                                className="composer-sticker-item"
                                disabled={stickerSaving}
                                key={sticker.sticker_id}
                                onClick={() => void sendSticker(sticker)}
                                type="button"
                              >
                                <StickerImage src={resolveStableResourceUri(sticker.uri) ?? sticker.uri} />
                              </button>
                            ))}
                            {mineStickersLoading ? (
                              <span className="composer-sticker-page-loading" aria-label={t("common.loading")} />
                            ) : null}
                          </div>
                        ) : !mineStickersLoading ? (
                          <div className="composer-sticker-empty">
                            <span className="material-symbols-outlined">photo_library</span>
                            <strong>{t("sticker.mineEmpty")}</strong>
                            {openStickerManager ? <FeatureDiscoveryTarget rewardId="capability.sticker">
                              <button onClick={openStickerManager} type="button">{t("sticker.addFirst")}</button>
                            </FeatureDiscoveryTarget> : null}
                          </div>
                        ) : <span className="composer-sticker-loading is-centered" aria-label={t("common.loading")} />}
                      </div>
                    ) : emojiPage === STICKER_EXPLORE_PAGE ? (
                      <div className="composer-sticker-pane" role="tabpanel" aria-label={t("sticker.explore")}>
                        {exploreStickers.length ? (
                          <div className="composer-sticker-grid has-frequent-row" onScroll={(event) => handleStickerGridScroll?.(event, "explore")}>
                            {exploreStickers.map((sticker, index) => (
                              <div className={`composer-sticker-explore-item${index < frequentExploreStickerIds.length && frequentExploreStickerIds.includes(sticker.sticker_asset_id) ? " is-frequent" : ""}`} key={sticker.sticker_asset_id}>
                                <button aria-label={t("sticker.send")} className="composer-sticker-item is-explore" disabled={stickerSaving} onClick={() => void sendSticker(sticker)} type="button">
                                  <StickerImage src={resolveStableResourceUri(sticker.uri) ?? sticker.uri} />
                                </button>
                                <span className={`composer-sticker-source is-${sticker.source_scope ?? "external"}`}>
                                  {sticker.source_scope === "local" && sticker.source_user ? (
                                    <>
                                      <UserAvatar className="composer-sticker-source-avatar" name={sticker.source_user.name} uri={sticker.source_user.avatar_uri} />
                                      <span className={`composer-sticker-source-name${sticker.source_user.name.length > 8 ? " is-scrolling" : ""}`}>
                                        <span>{sticker.source_user.name}</span>
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined" aria-hidden="true">public</span>
                                      <span>{t("sticker.externalSource")}</span>
                                    </>
                                  )}
                                </span>
                                {collectExploredSticker ? <button aria-label={t("sticker.collect")} className="composer-sticker-collect" disabled={stickerSaving} onClick={() => void collectExploredSticker?.(sticker)} type="button">
                                  <span className="material-symbols-outlined">add</span>
                                </button> : null}
                              </div>
                            ))}
                            {exploreStickersLoading ? (
                              <span className="composer-sticker-page-loading" aria-label={t("common.loading")} />
                            ) : null}
                          </div>
                        ) : !exploreStickersLoading ? (
                          <div className="composer-sticker-empty">
                            <span className="material-symbols-outlined">explore</span>
                            <strong>{t("sticker.exploreEmpty")}</strong>
                          </div>
                        ) : <span className="composer-sticker-loading is-centered" aria-label={t("common.loading")} />}
                      </div>
                    ) : (
                      <div className={`composer-emoji-grid${emojiPage === 0 ? " has-frequent-row" : ""}`} role="tabpanel" aria-label={t(EMOJI_PAGES[emojiPage].labelKey as TranslationKey)}>
                        {visibleEmojis.map((emoji, index) => (
                          <button
                            aria-label={t("emoji.insert", { emoji })}
                            className={emojiPage === 0 && index < 8 ? "is-frequent" : ""}
                            key={`${emoji}-${index}`}
                            onClick={() => insertEmoji(emoji)}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>);
}

