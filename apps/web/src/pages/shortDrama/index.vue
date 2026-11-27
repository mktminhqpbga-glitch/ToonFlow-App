<template>
  <div class="dramaPage">
    <aside class="navRail">
      <div class="brand"><img :src="logoUrl" alt="" /><strong>MacFlow</strong></div>
      <creativeNavigation compact />
    </aside>
    <main class="dramaMain">
      <header class="pageHeader">
        <div>
          <router-link to="/shortDrama" class="sectionLink">Phim ngắn</router-link>
          <h1>Bảng phân cảnh</h1>
          <p v-if="workspaceStore.project">Dự án đang mở <strong>{{ workspaceStore.project.name }}</strong></p>
        </div>
        <div v-if="ready" class="boardActions">
          <div class="buttonRow">
            <el-select class="boardPicker" :modelValue="boardId" :loading="boardsLoading" :disabled="working" aria-label="Chọn bảng phân cảnh" @change="openBoard">
              <el-option v-for="option in boardOptions" :key="option.id" :label="option.label" :value="option.id" />
            </el-select>
            <el-button :icon="IconPlus" :disabled="working" @click="createBoard">Tạo storyboard mới</el-button>
          </div>
          <div class="saveGroup">
            <el-button type="primary" :icon="IconDeviceFloppy" :loading="action === 'save'" :disabled="!!action" @click="saveBoard(true)">Lưu dự án</el-button>
            <p class="saveStatus" role="status">{{ saveStatus }}</p>
          </div>
        </div>
      </header>

      <el-alert v-if="!directory" title="Mở một dự án để bắt đầu" type="warning" :closable="false" showIcon>
        <router-link to="/home">Chọn dự án ở Trang chủ</router-link>
      </el-alert>
      <p v-else-if="loading" role="status">Đang mở bảng phân cảnh…</p>
      <el-alert v-else-if="loadError" :title="loadError" type="error" :closable="false" showIcon>
        <div class="buttonRow">
          <el-button size="small" @click="loadBoard">Tải lại</el-button>
          <router-link v-if="boardId !== defaultBoardId" to="/shortDrama/storyboard">Mở bảng ban đầu</router-link>
        </div>
      </el-alert>

      <template v-else-if="ready">
        <el-alert v-if="draftConflict" class="notice" title="Dự án đã thay đổi ở cửa sổ khác. Hãy tải bản nháp để giữ nội dung trước khi mở bản đã lưu." type="warning" :closable="false" showIcon>
          <el-button size="small" :disabled="working" @click="openSavedBoard">Mở bản đã lưu</el-button>
        </el-alert>
        <nav class="viewActions buttonRow" aria-label="Chế độ bảng phân cảnh">
          <el-button :type="!imageView ? 'primary' : 'default'" :aria-pressed="!imageView" @click="switchView(false)">Chỉnh phân cảnh</el-button>
          <el-button :type="imageView ? 'primary' : 'default'" :aria-pressed="imageView" @click="switchView(true)">Tạo ảnh theo cảnh</el-button>
        </nav>
        <sceneImageStudio v-show="imageView" :key="JSON.stringify([directory, boardId])"
          :directory="directory" :boardId="boardId" :scenes="board.scenes" :visible="imageView" :disabled="working || draftConflict"
          :saveBoard="saveBoard" @prompt="editSceneImagePrompt" @catalog="filmReferenceNames = $event" @queued="imageQueuePending = $event" />
        <div v-show="!imageView" class="workArea">
          <el-card class="scriptCard" shadow="never">
            <template #header><h2><icon-file-text :size="20" /> Kịch bản</h2></template>
            <div class="formFields">
              <label class="dramaField"><span>Tên phim hoặc tập</span>
                <el-input v-model="board.title" :maxlength="200" :disabled="!!action" placeholder="Ví dụ: Một ngày ở Đà Lạt" @input="markDirty" />
              </label>
              <label class="dramaField"><span>Nội dung kịch bản</span>
                <el-input v-model="board.script" type="textarea" :rows="8" :maxlength="scriptLimit" :disabled="!!action || splitting"
                  placeholder="Dán kịch bản hoặc viết ý tưởng và lời thoại tại đây…" @input="markDirty" />
                <small class="hint">{{ scriptStats }}</small>
              </label>
              <details class="guide">
                <summary>Xem ví dụ định dạng kịch bản</summary>
                <p>Cảnh 1 · Bến xe · Buổi sáng<br />Mai kéo vali xuống xe, nhìn quanh tìm mẹ.<br />Mai: “Mẹ ơi, con tới rồi!”</p>
                <p>Tách mỗi cảnh bằng một dòng trống. Ghi bối cảnh, hành động và tên người nói trước lời thoại.</p>
              </details>
              <label class="dramaField"><span>Nhân vật</span>
                <el-input v-model="board.characters" type="textarea" :rows="2" :maxlength="4000" :disabled="!!action"
                  placeholder="Mỗi dòng một nhân vật, ví dụ Mai — nhân vật chính" @input="markDirty" />
              </label>
              <div class="modelGroup formFields">
                <label class="dramaField"><span>Mô hình văn bản</span>
                  <el-select v-model="modelChoice" filterable :disabled="!!action" :loading="modelsLoading" placeholder="Chọn mô hình từ Cài đặt">
                    <el-option v-if="board.model && !selectedModel" :value="board.model" label="Mô hình đã lưu · chưa khả dụng" disabled />
                    <el-option v-for="model in models" :key="getNodeModelKey(model)" :value="getNodeModelKey(model)" :label="`${model.label} · ${model.providerLabel}`" />
                  </el-select>
                </label>
                <p class="hint">Mô hình đọc kịch bản để chia và Việt hóa cảnh. “muse/text · api” là mô hình văn bản Muse qua kết nối đã lưu trong MacFlow.</p>
                <p class="hint">Mỗi lượt chờ tối đa {{ aiLimitSeconds }} giây. Chi phí theo nhà cung cấp và lượng văn bản gửi đi. Giá trước lượt gọi chưa có sẵn.</p>
                <p v-if="modelError" class="fieldError" role="alert">{{ modelError }}</p>
                <div class="buttonRow">
                  <el-button type="primary" :icon="IconSparkles" :disabled="!!splitDisabled" :aria-describedby="splitDisabled ? 'splitHelp' : undefined" @click="splitScript">AI chia phân cảnh</el-button>
                  <el-button :loading="modelsLoading" @click="loadModels(true)">Tải lại mô hình</el-button>
                </div>
                <p v-if="splitDisabled && !splitting" id="splitHelp" class="hint">{{ splitDisabled }}</p>
                <template v-if="splitting || splitFeedback">
                  <div v-if="splitting" class="aiStatus">
                    <el-progress :indeterminate="true" :percentage="100" :showText="false" />
                    <p role="status">{{ progressText }}</p>
                    <el-button size="small" @click="generation?.controller.abort()">Dừng chia cảnh</el-button>
                  </div>
                  <el-alert v-else-if="splitFeedback" :title="splitFeedback.text" :type="splitFeedback.type" :closable="false" showIcon />
                </template>
              </div>
            </div>
          </el-card>

          <el-card class="sceneCard" shadow="never">
            <template #header>
              <div class="sceneHeader">
                <div>
                  <h2><icon-movie :size="20" /> Phân cảnh <span class="sceneCount">{{ board.scenes.length }}</span></h2>
                  <p class="hint sceneTotal">Tổng thời lượng {{ estimatedDurations ? 'khoảng ' : '' }}{{ durationText }}<span v-if="unknownDurations"> · {{ unknownDurations }} cảnh chưa có thời lượng</span></p>
                </div>
                <div class="buttonRow">
                  <el-button v-if="canEstimateDuration" :disabled="sceneListLocked || !!translation" @click="fillSceneDurations">Ước tính thời lượng còn thiếu</el-button>
                  <el-button :icon="IconFileImport" :disabled="sceneListLocked || !!generation" @click="importVisible = true">Nhập từ Huobao</el-button>
                  <el-button :icon="IconPlus" :disabled="sceneListLocked || board.scenes.length >= sceneLimit" @click="addScene">Thêm cảnh</el-button>
                </div>
              </div>
            </template>

            <div v-if="board.scenes.length" class="sceneBody">
              <div class="sceneFinder">
                <el-input v-model="sceneQuery" clearable placeholder="Tìm theo tên, mô tả hoặc lời thoại…" aria-label="Tìm phân cảnh" />
                <p class="hint">Kéo cảnh bằng biểu tượng ⋮⋮, hoặc dùng nút Lên trước và Xuống sau. {{ sceneQuery.trim() ? 'Xóa từ khóa để đổi thứ tự.' : 'Cuộn dọc danh sách nếu có nhiều cảnh.' }}</p>
              </div>
              <nav v-if="visibleScenes.length" class="sceneTimeline" aria-label="Thứ tự phân cảnh">
                <div v-for="{ scene, index } in visibleScenes" :key="scene.id" class="sceneTab"
                  :class="{ active: scene.id === activeScene?.id, dropTarget: dropTarget === scene.id }"
                  @dragover="dragOverScene($event, scene.id)" @drop="dropScene($event, scene.id)">
                  <span v-if="canReorder && board.scenes.length > 1" class="dragHandle" aria-hidden="true" title="Kéo để đổi thứ tự" draggable="true"
                    @dragstart="beginDrag($event, scene.id)" @dragend="resetDrag">⋮⋮</span>
                  <button type="button" :title="scene.title || `Cảnh ${index + 1}`" :aria-pressed="scene.id === activeScene?.id" @click="activeId = scene.id">
                    <span class="sceneIndex">{{ index + 1 }}</span><span class="sceneTitle">{{ scene.title || `Cảnh ${index + 1}` }}</span>
                  </button>
                </div>
              </nav>
              <p v-else class="emptySearch" role="status">Không tìm thấy cảnh phù hợp. Hãy đổi hoặc xóa từ khóa.</p>

              <div v-if="translation" class="aiStatus">
                <el-progress :indeterminate="true" :percentage="100" :showText="false" />
                <p role="status">Đang Việt hóa {{ translation.label }} · {{ progressText }}</p>
                <el-button size="small" @click="generation?.controller.abort()">Dừng Việt hóa</el-button>
              </div>
              <el-alert v-if="translationFeedback" :title="translationFeedback.text" :type="translationFeedback.type" :closable="false" showIcon />
              <div v-if="removedScene" class="undoBar">
                <span role="status">Đã bỏ “{{ removedScene.scene.title || 'Cảnh' }}”.</span>
                <el-button size="small" :disabled="sceneListLocked || board.scenes.length >= sceneLimit" @click="undoRemove">Hoàn tác</el-button>
              </div>

              <section v-if="activeScene && visibleScenes.some(item => item.scene.id === activeId)" class="formFields sceneEditor" aria-label="Chỉnh phân cảnh">
                <div class="sceneDetails">
                  <label class="dramaField"><span>Tên cảnh</span><el-input v-model="activeScene.title" :maxlength="200" :disabled="sceneLocked" @input="markDirty" /></label>
                  <label class="dramaField"><span>Thời lượng (giây)</span><el-input-number v-model="activeScene.duration" :min="0" :max="3600" :disabled="sceneLocked" @change="updateDuration" />
                    <small v-if="activeScene.durationEstimated" class="hint">Ước tính. Bạn có thể chỉnh theo nhịp dựng.</small>
                    <small v-else-if="!activeScene.duration" class="hint">Cảnh này chưa có thời lượng.</small>
                  </label>
                </div>
                <label class="dramaField"><span>Mô tả cảnh và góc máy</span><el-input v-model="activeScene.description" type="textarea" :rows="3" :maxlength="10000" :disabled="sceneLocked" @input="markDirty" /></label>
                <label class="dramaField"><span>Lời thoại hoặc thuyết minh</span><el-input v-model="activeScene.dialogue" type="textarea" :rows="2" :maxlength="10000" :disabled="sceneLocked" @input="markDirty" /></label>
                <label class="dramaField"><span>Ghi chú sản xuất</span><el-input v-model="activeScene.notes" type="textarea" :rows="2" :maxlength="10000" :disabled="sceneLocked" @input="markDirty" /></label>
                <div class="scenePreview">
                  <a v-if="previewUrl && !previewError" :href="previewUrl" target="_blank" rel="noopener" title="Xem ảnh cảnh ở kích thước gốc">
                    <img :src="previewUrl" :alt="`Ảnh xem trước của ${activeScene.title || 'cảnh'}`" @error="previewError = 'Không mở được ảnh của cảnh này.'" />
                  </a>
                  <div class="formFields">
                    <strong>Ảnh xem trước</strong>
                    <small v-if="previewError" class="fieldError" role="alert">{{ previewError }}</small>
                    <small v-else class="hint">{{ activeScene.thumbnail ? (previewUrl ? 'Bấm ảnh để xem lớn hơn.' : 'Đang mở ảnh…') : 'Thêm một ảnh để nhận ra cảnh khi chỉnh sửa.' }}</small>
                    <div class="buttonRow">
                      <el-button size="small" :loading="uploading" :disabled="sceneLocked" @click="thumbnailInput?.click()">{{ activeScene.thumbnail ? 'Đổi ảnh cảnh' : 'Tải ảnh cảnh' }}</el-button>
                      <el-button v-if="activeScene.thumbnail" size="small" :disabled="sceneLocked || uploading" @click="removeThumbnail">Gỡ ảnh khỏi cảnh</el-button>
                    </div>
                    <input ref="thumbnailInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="uploadThumbnail" />
                  </div>
                </div>
                <div class="promptGrid">
                  <div class="promptPanel">
                    <label class="dramaField"><span>Prompt ảnh</span><el-input v-model="activeScene.imagePrompt" type="textarea" :autosize="{ minRows: 3 }" :maxlength="10000" showWordLimit :disabled="sceneLocked" @input="markDirty" /></label>
                    <el-button v-if="activeSceneHasReferences" plain :icon="IconPhoto" @click="switchView(true)">Mở Tạo ảnh theo cảnh</el-button>
                    <el-button v-else plain :icon="IconPhoto" :disabled="sceneLocked || !activeScene.imagePrompt.trim()" @click="openStudio('image')">Đưa sang Xưởng ảnh</el-button>
                    <small v-if="!activeScene.imagePrompt.trim()" class="hint">Nhập prompt ảnh để gửi sang xưởng.</small>
                  </div>
                  <div class="promptPanel">
                    <label class="dramaField"><span>Prompt video</span><el-input v-model="activeScene.videoPrompt" type="textarea" :autosize="{ minRows: 3 }" :maxlength="10000" showWordLimit :disabled="sceneLocked" @input="markDirty" /></label>
                    <el-button plain :icon="IconVideo" :disabled="sceneLocked || !activeScene.videoPrompt.trim()" @click="openStudio('video')">Đưa sang Xưởng video</el-button>
                    <small v-if="!activeScene.videoPrompt.trim()" class="hint">Nhập prompt video để gửi sang xưởng.</small>
                  </div>
                </div>
                <div class="buttonRow sceneActions">
                  <el-button :icon="IconLanguage" :disabled="!!translateDisabled" :aria-describedby="translateDisabled ? 'translateHelp' : undefined" @click="translateScene">Việt hóa cảnh</el-button>
                  <el-button :icon="IconArrowLeft" title="Đưa cảnh lên trước" :disabled="!canReorder || activeIndex < 1" @click="moveActiveScene(-1)">Lên trước</el-button>
                  <el-button :icon="IconArrowRight" title="Đưa cảnh xuống sau" :disabled="!canReorder || activeIndex === board.scenes.length - 1" @click="moveActiveScene(1)">Xuống sau</el-button>
                  <el-button plain type="danger" :disabled="sceneLocked" @click="removeScene">Bỏ cảnh</el-button>
                </div>
                <p v-if="translateDisabled && !translation" id="translateHelp" class="hint">{{ translateDisabled }}</p>
              </section>
            </div>
            <div v-else class="sceneEmpty">
              <h3>Chưa có phân cảnh</h3>
              <ol>
                <li>Nhập tên và dán nội dung vào ô Kịch bản.</li>
                <li>Chọn mô hình rồi bấm AI chia phân cảnh. Bạn cũng có thể thêm cảnh thủ công hoặc nhập tập từ Huobao.</li>
                <li>Kiểm tra từng cảnh rồi xuất hoặc chuyển sang xưởng.</li>
              </ol>
              <div v-if="removedScene" class="undoBar">
                <p role="status">Đã bỏ “{{ removedScene.scene.title || 'Cảnh' }}”.</p>
                <el-button size="small" :disabled="sceneListLocked" @click="undoRemove">Hoàn tác</el-button>
              </div>
            </div>
            <footer class="outputBar">
              <p v-if="exportDisabled" id="exportHelp" class="hint">Thêm một cảnh hoặc nhập kịch bản để xuất.</p>
              <p v-if="outputDisabled" id="outputHelp" class="hint">Cần ít nhất một cảnh để đưa vào Canvas.</p>
              <div class="buttonRow">
                <el-button :icon="IconDownload" :loading="downloading" :disabled="!!exportDisabled || downloading" :aria-describedby="exportDisabled ? 'exportHelp' : undefined" @click="downloadBoard">Tải Markdown</el-button>
                <el-button :icon="IconPrinter" :disabled="!!exportDisabled" :aria-describedby="exportDisabled ? 'exportHelp' : undefined" @click="printBoard">In hoặc lưu PDF</el-button>
                <el-button type="primary" plain :icon="IconLayoutDashboard" :disabled="outputDisabled || !!action" :aria-describedby="outputDisabled ? 'outputHelp' : undefined" @click="sendToCanvas">Đưa vào Canvas</el-button>
              </div>
            </footer>
          </el-card>
        </div>
      </template>
    </main>

    <el-dialog v-model="importVisible" title="Nhập phân cảnh từ Huobao" width="min(560px, calc(100vw - 24px))" appendToBody
      :closeOnClickModal="action !== 'import'" :closeOnPressEscape="action !== 'import'" :showClose="action !== 'import'">
      <div class="formFields">
        <label class="dramaField"><span>Địa chỉ Huobao</span><el-input v-model="huobaoAddress" placeholder="http://localhost:5679" :disabled="action === 'import'" /></label>
        <label class="dramaField"><span>ID tập</span><el-input v-model="huobaoEpisode" inputmode="numeric" placeholder="Ví dụ: 3" :disabled="action === 'import'" /></label>
        <p class="hint">Mở tập trong Huobao và xem ID trong địa chỉ hoặc thông tin tập. ID có thể khác số thứ tự của tập. <a :href="huobaoGuide" target="_blank" rel="noopener noreferrer">Xem hướng dẫn lấy ID và tệp JSON</a></p>
        <label class="dramaField"><span>Ghi chú nhập <small class="hint">Tùy chọn</small></span>
          <el-input v-model="importNotes" type="textarea" :rows="2" :maxlength="10000" :disabled="action === 'import'" placeholder="Ví dụ: Tập 3, bản dựng ngày 27/11" />
        </label>
        <p class="hint">Ghi chú giúp nhận biết nguồn hoặc phiên bản của tập khi xem lại. Ghi chú được lưu trong bảng phân cảnh.</p>
        <details class="guide">
          <summary>Kết nối Huobao có khóa truy cập</summary>
          <label class="dramaField"><span>Khóa truy cập Huobao (API Key)</span>
            <el-input v-model="huobaoKey" type="password" autocomplete="off" :maxlength="2048" :disabled="action === 'import'" />
          </label>
          <p class="hint">Nếu máy chủ của bạn yêu cầu khóa, lấy khóa do người quản trị Huobao cấp. Máy chủ cần cho phép MacFlow gửi khóa. Khóa chỉ dùng cho lần nhập này.</p>
          <el-button :disabled="!huobaoEpisode.trim() || !huobaoKey.trim() || action === 'import'" :loading="action === 'import'" @click="importWithKey">Nhập bằng khóa truy cập</el-button>
        </details>
        <div class="buttonRow">
          <el-button :disabled="!huobaoEpisode.trim() || action === 'import'" @click="openHuobaoJson">Mở JSON của tập</el-button>
          <el-button type="primary" :loading="action === 'import'" :disabled="!!action" @click="fileInput?.click()">Chọn tệp JSON</el-button>
        </div>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile" />
        <details class="guide">
          <summary>Dán JSON</summary>
          <el-input v-model="pastedJson" type="textarea" :rows="4" :disabled="!!action" aria-label="Nội dung JSON từ Huobao" />
          <el-button :disabled="!!action || !pastedJson.trim()" @click="importJson(() => pastedJson)">Nhập nội dung đã dán</el-button>
        </details>
        <el-alert v-if="importError" :title="importError" type="error" :closable="false" showIcon />
      </div>
    </el-dialog>

    <Teleport to="body">
      <article v-if="printSnapshot" class="macflowStoryboardPrint" lang="vi" aria-label="Bản in bảng phân cảnh">
        <h1>{{ printSnapshot.title.trim() || 'Phim ngắn' }}</h1>
        <p v-if="printSnapshot.script">{{ printSnapshot.script }}</p>
        <template v-if="printSnapshot.characters"><h2>Nhân vật</h2><p>{{ printSnapshot.characters }}</p></template>
        <template v-if="printSnapshot.importNotes"><h2>Ghi chú nhập từ Huobao</h2><p>{{ printSnapshot.importNotes }}</p></template>
        <section v-for="(scene, index) in printSnapshot.scenes" :key="scene.id">
          <h2>{{ index + 1 }}. {{ scene.title || 'Cảnh' }}<span v-if="scene.duration"> ({{ scene.durationEstimated ? 'khoảng ' : '' }}{{ scene.duration }} giây)</span></h2>
          <p v-if="scene.description">{{ scene.description }}</p>
          <p v-if="scene.dialogue"><strong>Lời thoại</strong><br />{{ scene.dialogue }}</p>
          <p v-if="scene.imagePrompt"><strong>Prompt ảnh</strong><br />{{ scene.imagePrompt }}</p>
          <p v-if="scene.videoPrompt"><strong>Prompt video</strong><br />{{ scene.videoPrompt }}</p>
          <p v-if="scene.notes"><strong>Ghi chú sản xuất</strong><br />{{ scene.notes }}</p>
        </section>
      </article>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { ElMessage, ElMessageBox } from "element-plus";
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy, IconDownload, IconFileImport, IconLanguage, IconLayoutDashboard, IconPhoto, IconPlus, IconPrinter, IconSparkles, IconVideo } from "@tabler/icons-vue";
import { computed, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { createNodeRequestId, getNodeModelIdentity, getNodeModelKey, useNodeAi, type NodeAiModel } from "@toonflow/nodes-scaffold/nodeAi";
import logoUrl from "@toonflow/assets/logo.svg";
import creativeNavigation from "@/components/creativeNavigation.vue";
import { clearStudioMediaForCanvas, queueStudioMediaForCanvas, type StudioMediaTransfer } from "@/lib/mediaStudioTransfer";
import { clearStudioPrompt, queueStudioPrompt } from "@/lib/studioPromptTransfer";
import saveFile from "@/lib/saveFile";
import sceneImageStudio from "./sceneImageStudio.vue";
import { promptReferences } from "./storyboardImages";
import useWorkspaceFiles, { type TextSnapshot } from "@/lib/workspaceFiles";
import { useWorkspaceStore } from "@/stores/workspace";
import { currentUser } from "@/stores/multiTenant";
import { defaultBoardId, emptyBoard, estimateSceneDuration, hasSceneText, huobaoStoryboardUrl, importByteLimit, importHuobaoScenes, newScene, readDramaBoard,
  readGeneratedScenes, readTranslatedScene, sceneLimit, scriptLimit, splitSystemPrompt, storyboardId, storyboardIdFromPath,
  storyboardExportName, storyboardMarkdown, storyboardPath, translateSystemPrompt, type DramaScene } from "./shortDrama";

type Feedback = { type: "success" | "error" | "info"; text: string };
type Generation = { kind: "split" | "translate"; controller: AbortController; sceneId?: string; label?: string };

const workspaceStore = useWorkspaceStore();
const route = useRoute();
const router = useRouter();
const ai = useNodeAi();
const aiLimitSeconds = 120;
const huobaoGuide = "https://github.com/mktminhqpbga-glitch/ToonFlow-App/blob/feat/macflow-media-studios/docs/shortDrama.md#nhập-một-tập-từ-huobao-drama";
const directory = computed(() => workspaceStore.project?.directory ?? "");
const boardId = computed(() => storyboardId(route.query.board));
const imageView = computed(() => route.query.view === "images");
const filmReferenceNames = ref<string[]>([]);
const imageQueuePending = ref(false);
const board = ref(emptyBoard());
const ready = ref(false);
let snapshot: TextSnapshot | undefined;
let loadVersion = 0;
const dirty = ref(false);
const loading = ref(false);
const loadError = ref("");
const action = ref<"save" | "import" | "create">();
const downloading = ref(false);
const generation = shallowRef<Generation>();
const splitting = computed(() => generation.value?.kind === "split");
const translation = computed(() => generation.value?.kind === "translate" ? generation.value : undefined);
const working = computed(() => loading.value || !!action.value || !!generation.value);
const sceneListLocked = computed(() => !!action.value || splitting.value || imageQueuePending.value);
const sceneLocked = computed(() => sceneListLocked.value || translation.value?.sceneId === activeId.value);
const splitFeedback = ref<Feedback>();
const translationFeedback = ref<Feedback>();
const elapsed = ref(0);
const receiving = ref(false);
const progressText = computed(() => `${receiving.value ? "Đang nhận kết quả" : "Đang chờ mô hình phản hồi"} · ${elapsed.value} / ${aiLimitSeconds} giây`);
const models = shallowRef<NodeAiModel[]>([]);
const modelsLoading = ref(false);
const modelError = ref("");
const boardsLoading = ref(false);
const knownBoards = ref<{ id: string; label: string }[]>([]);
let boardListVersion = 0;
const boardOptions = computed(() => [
  ...knownBoards.value.filter(option => option.id !== boardId.value),
  { id: boardId.value, label: board.value.title.trim() || (boardId.value === defaultBoardId ? "Bảng phân cảnh ban đầu" : "Bảng chưa đặt tên") },
].sort((a, b) => a.label.localeCompare(b.label, "vi")));
const importVisible = ref(false);
const importError = ref("");
const huobaoAddress = ref("http://localhost:5679");
const huobaoEpisode = ref("");
const huobaoKey = ref("");
const importNotes = ref("");
const pastedJson = ref("");
const fileInput = ref<HTMLInputElement>();
const thumbnailInput = ref<HTMLInputElement>();
const uploading = ref(false);
const previewUrl = ref("");
const previewError = ref("");
const activeId = ref("");
const activeIndex = computed(() => board.value.scenes.findIndex(scene => scene.id === activeId.value));
const activeScene = computed(() => board.value.scenes[activeIndex.value]);
const activeSceneHasReferences = computed(() => {
  const refs = promptReferences(activeScene.value?.imagePrompt ?? "");
  return refs.invalid || !!refs.names.size;
});
const removedScene = shallowRef<{ scene: DramaScene; index: number }>();
const sceneQuery = ref("");
const draggedId = ref("");
const dropTarget = ref("");
const canReorder = computed(() => !sceneListLocked.value && !sceneQuery.value.trim());
const visibleScenes = computed(() => {
  const query = sceneQuery.value.trim().toLocaleLowerCase("vi");
  return board.value.scenes.map((scene, index) => ({ scene, index })).filter(({ scene }) => !query
    || [scene.title, scene.description, scene.dialogue, scene.notes].some(text => text.toLocaleLowerCase("vi").includes(query)));
});
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const scriptStats = computed(() => `${number.format(board.value.script.length)} / ${number.format(scriptLimit)} ký tự · ${number.format(board.value.script.trim().split(/\s+/).filter(Boolean).length)} từ`);
const unknownDurations = computed(() => board.value.scenes.filter(scene => !scene.duration).length);
const estimatedDurations = computed(() => board.value.scenes.some(scene => scene.durationEstimated));
const canEstimateDuration = computed(() => board.value.scenes.some(scene => !scene.duration && hasSceneText(scene)));
const durationText = computed(() => {
  const seconds = board.value.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0);
  return seconds < 60 ? `${number.format(seconds)} giây` : `${number.format(Math.floor(seconds / 60))} phút ${number.format(seconds % 60)} giây`;
});
const outputDisabled = computed(() => board.value.scenes.length === 0);
const modelChoice = computed({
  get: () => board.value.model || (models.value[0] ? getNodeModelKey(models.value[0]) : ""),
  set: value => { board.value.model = value; markDirty(); },
});
const selectedModel = computed(() => models.value.find(model => getNodeModelKey(model) === modelChoice.value));
const splitDisabled = computed(() => {
  if (imageQueuePending.value) return "Hãy hoàn tất hoặc bỏ hàng chờ ảnh trước khi chia lại phân cảnh.";
  if (action.value) return "Đợi thao tác hiện tại hoàn tất.";
  if (generation.value) return "AI đang xử lý một yêu cầu.";
  if (!board.value.script.trim()) return "Nhập nội dung kịch bản để AI chia cảnh.";
  if (!selectedModel.value) return "Chọn mô hình văn bản để chia cảnh.";
  return "";
});
const translateDisabled = computed(() => {
  if (sceneListLocked.value) return "Đợi thao tác hiện tại hoàn tất.";
  if (generation.value) return "AI đang xử lý một yêu cầu.";
  if (!activeScene.value || !hasSceneText(activeScene.value)) return "Nhập tên riêng cho cảnh, mô tả, lời thoại hoặc prompt để Việt hóa.";
  if (!selectedModel.value) return "Chọn mô hình văn bản để Việt hóa cảnh.";
  return "";
});

function errorText(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || "Không liên hệ được MacFlow. Hãy kiểm tra kết nối rồi thử lại.";
  if (error instanceof SyntaxError) return "JSON không hợp lệ. Hãy mở và lưu lại phản hồi đầy đủ.";
  return error instanceof Error ? error.message : "Không thể hoàn tất thao tác.";
}
function errorCode(error: unknown) {
  return axios.isAxiosError<{ data?: { code?: string } }>(error) ? error.response?.data?.data?.code : undefined;
}
const draftKey = (target: string, id: string) => "macflow.storyboard.draft:" + JSON.stringify(id === defaultBoardId
  ? [currentUser.value?.id ?? "standalone", target] : [currentUser.value?.id ?? "standalone", target, id]);
const draftStored = ref(false);
const draftConflict = ref(false);
const draftAt = ref<number>();
const localTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
let draftBase = "";
const saveStatus = computed(() => {
  if (dirty.value) {
    if (!draftStored.value) return "Có thay đổi chưa lưu. Hãy bấm Lưu dự án.";
    return draftAt.value ? `Đã lưu nháp trên máy lúc ${localTime.format(draftAt.value)}` : "Đã khôi phục bản nháp trên máy.";
  }
  if (board.value.savedAt) return `Đã lưu dự án lúc ${localTime.format(board.value.savedAt)}`;
  return snapshot ? "Đang mở bản đã lưu trong dự án." : "Chưa có bản lưu trong dự án.";
});

function markDirty() {
  dirty.value = true;
  try {
    const savedAt = Date.now();
    localStorage.setItem(draftKey(directory.value, boardId.value), JSON.stringify({
      revision: draftConflict.value ? draftBase : snapshot?.revision ?? "", text: JSON.stringify(board.value), activeId: activeId.value, savedAt,
    }));
    draftAt.value = savedAt;
    draftStored.value = true;
  } catch { draftStored.value = false; }
}

function restoreDraft(target: string, id: string) {
  try {
    const entry = JSON.parse(localStorage.getItem(draftKey(target, id)) ?? "null") as { revision: string; text: string; activeId?: string; savedAt?: number } | null;
    if (!entry || typeof entry.text !== "string") return;
    const recovered = readDramaBoard(entry.text);
    if (JSON.stringify(recovered) === JSON.stringify(board.value)) return;
    draftBase = typeof entry.revision === "string" ? entry.revision : "";
    draftConflict.value = draftBase !== (snapshot?.revision ?? "");
    board.value = recovered;
    activeId.value = recovered.scenes.find(scene => scene.id === entry.activeId)?.id ?? recovered.scenes[0]?.id ?? "";
    if (typeof entry.savedAt === "number" && entry.savedAt > 0 && entry.savedAt <= Date.now()) draftAt.value = entry.savedAt;
    dirty.value = draftStored.value = true;
  } catch { /* Dự án vẫn mở được nếu bản nháp hỏng. */ }
}

async function loadBoard() {
  const target = directory.value;
  const id = boardId.value;
  const version = ++loadVersion;
  generation.value?.controller.abort();
  ready.value = false;
  snapshot = undefined;
  loadError.value = "";
  loading.value = !!target;
  dirty.value = draftStored.value = draftConflict.value = false;
  draftAt.value = undefined;
  removedScene.value = splitFeedback.value = translationFeedback.value = undefined;
  sceneQuery.value = "";
  board.value = emptyBoard();
  activeId.value = "";
  if (!target) return;
  try {
    const saved = await useWorkspaceFiles(target).readTextSnapshot(storyboardPath(id), { maxBytes: importByteLimit });
    if (version !== loadVersion) return;
    board.value = readDramaBoard(saved.text);
    snapshot = saved;
    activeId.value = board.value.scenes[0]?.id ?? "";
    ready.value = true;
    restoreDraft(target, id);
  } catch (error) {
    if (version !== loadVersion) return;
    if (id === defaultBoardId && errorCode(error) === "ENOENT") { ready.value = true; restoreDraft(target, id); }
    else loadError.value = `Không mở được bảng phân cảnh. ${errorText(error)}`;
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}

async function loadBoards() {
  const target = directory.value;
  const version = ++boardListVersion;
  knownBoards.value = [];
  boardsLoading.value = !!target;
  if (!target) return;
  try {
    const files = useWorkspaceFiles(target);
    const { entries } = await files.list("", AbortSignal.timeout(10_000));
    const ids = entries.flatMap(item => {
      const id = item.type === "file" ? storyboardIdFromPath(item.name) : undefined;
      return id ? [id] : [];
    });
    const options = [];
    for (let index = 0; index < ids.length && version === boardListVersion; index += 6) {
      options.push(...await Promise.all(ids.slice(index, index + 6).map(async id => {
        const fallback = id === defaultBoardId ? "Bảng phân cảnh ban đầu" : `Bảng ${id.slice(0, 8)}`;
        try {
          const prefix = await files.readText(storyboardPath(id), 2048, AbortSignal.timeout(10_000));
          const title = prefix.match(/"title"\s*:\s*("(?:[^"\\]|\\.)*")/)?.[1];
          return { id, label: (title && String(JSON.parse(title)).trim()) || fallback };
        } catch { return { id, label: fallback }; }
      })));
    }
    if (version === boardListVersion) {
      const updatedIds = new Set(knownBoards.value.map(item => item.id));
      knownBoards.value = [...options.filter(item => !updatedIds.has(item.id)), ...knownBoards.value];
    }
  } catch {
    if (version === boardListVersion) ElMessage.error("Chưa tải được danh sách bảng phân cảnh.");
  } finally {
    if (version === boardListVersion) boardsLoading.value = false;
  }
}

function openBoard(id: string) {
  if (id === boardId.value || working.value) return;
  void router.push({ path: "/shortDrama/storyboard", query: { board: id === defaultBoardId ? undefined : id, view: imageView.value ? "images" : undefined } });
}

function switchView(images: boolean) {
  if (images !== imageView.value) void router.replace({ query: { ...route.query, view: images ? "images" : undefined } });
}

function editSceneImagePrompt(id: string, prompt: string) {
  const scene = board.value.scenes.find(item => item.id === id);
  if (scene && !working.value && !draftConflict.value) {
    scene.imagePrompt = prompt;
    markDirty();
  }
}

async function openSavedBoard() {
  const version = loadVersion;
  const accepted = await ElMessageBox.confirm("Mở bản đã lưu sẽ bỏ bản nháp đang sửa trên máy này. Bạn có thể tải Markdown trước để giữ nội dung.",
    "Mở bản đã lưu?", { confirmButtonText: "Mở bản đã lưu", cancelButtonText: "Giữ bản nháp" }).then(() => true, () => false);
  if (!accepted || version !== loadVersion) return;
  try { localStorage.removeItem(draftKey(directory.value, boardId.value)); }
  catch { ElMessage.error("Chưa mở được bản đã lưu. Hãy kiểm tra bộ nhớ trình duyệt rồi thử lại."); return; }
  await loadBoard();
}

async function saveBoard(notify = false) {
  if (!ready.value || action.value) return false;
  if (draftConflict.value) {
    ElMessage.error("Dự án đã đổi ở cửa sổ khác. Hãy tải Markdown để giữ bản đang chỉnh.");
    return false;
  }
  if (!dirty.value && snapshot) {
    if (notify) ElMessage.success("Bảng phân cảnh đã được lưu.");
    return true;
  }
  const target = directory.value;
  const id = boardId.value;
  const version = loadVersion;
  action.value = "save";
  try {
    const files = useWorkspaceFiles(target);
    const previousText = JSON.stringify(board.value);
    const nextBoard = { ...board.value, savedAt: Date.now() };
    const text = JSON.stringify(nextBoard, null, 2);
    if (new Blob([text]).size > importByteLimit) throw new Error("Bảng phân cảnh vượt 4 MiB. Hãy rút gọn một số cảnh rồi lưu lại.");
    readDramaBoard(text);
    let saved: TextSnapshot;
    if (snapshot) saved = { ...snapshot, text, revision: await files.writeTextSnapshot(storyboardPath(id), text, snapshot) };
    else {
      await files.write(storyboardPath(id), text, true);
      saved = await files.readTextSnapshot(storyboardPath(id), { maxBytes: importByteLimit });
      if (saved.text !== text) throw new Error("Bảng phân cảnh đã thay đổi trong lúc lưu. Hãy giữ bản đang chỉnh trước khi mở lại trang.");
    }
    if (version !== loadVersion) return false;
    snapshot = saved;
    const changed = JSON.stringify(board.value) !== previousText;
    board.value.savedAt = nextBoard.savedAt;
    if (changed) markDirty();
    else {
      dirty.value = draftStored.value = false;
      try {
        const key = draftKey(target, id);
        const draft = JSON.parse(localStorage.getItem(key) ?? "null");
        if (draft?.text === previousText) localStorage.removeItem(key);
      } catch { /* Bản trong dự án đã được ghi thành công. */ }
    }
    const label = nextBoard.title.trim() || (id === defaultBoardId ? "Bảng phân cảnh ban đầu" : `Bảng ${id.slice(0, 8)}`);
    knownBoards.value = [...knownBoards.value.filter(item => item.id !== id), { id, label }];
    if (notify) ElMessage.success("Đã lưu bảng phân cảnh trong dự án.");
    return true;
  } catch (error) {
    if (version === loadVersion) {
      if (["ESTALE", "EEXIST"].includes(errorCode(error) ?? "")) {
        draftBase = snapshot?.revision ?? "";
        draftConflict.value = true;
        ElMessage.error("Dự án đã đổi ở cửa sổ khác. Hãy tải Markdown để giữ bản đang chỉnh.");
      } else ElMessage.error(`Chưa lưu được bảng phân cảnh. ${errorText(error)}`);
    }
    return false;
  } finally { action.value = undefined; }
}

async function createBoard() {
  if (!ready.value || working.value) return;
  const version = loadVersion;
  const name = await ElMessageBox.prompt("Bảng mới sẽ được lưu riêng trong dự án đang mở.", "Tạo storyboard mới", {
    inputPlaceholder: "Ví dụ: Tập 2 — Gặp lại",
    inputValidator: value => !!value?.trim() && value.trim().length <= 200 || "Nhập tên từ 1 đến 200 ký tự.",
    confirmButtonText: "Tạo bảng", cancelButtonText: "Hủy",
  }).then(result => result.value.trim(), () => "");
  if (!name || version !== loadVersion || working.value) return;
  if (dirty.value && !draftStored.value && !(await saveBoard())) return;
  const id = createNodeRequestId();
  action.value = "create";
  try {
    await useWorkspaceFiles(directory.value).writeJson(storyboardPath(id), { ...emptyBoard(), title: name, savedAt: Date.now() }, true);
    if (version !== loadVersion) return;
    knownBoards.value = [...knownBoards.value, { id, label: name }];
  } catch (error) {
    if (version === loadVersion) ElMessage.error(`Chưa tạo được bảng mới. ${errorText(error)}`);
    return;
  } finally { action.value = undefined; }
  if (version === loadVersion && !await router.push({ path: "/shortDrama/storyboard", query: { board: id } })) {
    ElMessage.success(`Đã tạo bảng “${name}”.`);
  }
}

async function loadModels(notify = false) {
  if (modelsLoading.value) return;
  modelsLoading.value = true;
  modelError.value = "";
  try {
    models.value = (await ai.getModels(AbortSignal.timeout(15000), true)).filter(model => model.protocol !== "chrome");
    if (models.value.length) {
      if (notify) ElMessage.success(`Đã tải lại ${models.value.length} mô hình văn bản.`);
    } else {
      modelError.value = "Chưa có mô hình văn bản. Hãy thêm mô hình trong Cài đặt MacFlow.";
      if (notify) ElMessage.warning(modelError.value);
    }
  } catch {
    modelError.value = "Chưa tải được mô hình. Kiểm tra kết nối rồi thử lại.";
    if (notify) ElMessage.error(modelError.value);
  } finally { modelsLoading.value = false; }
}

async function confirmReplace() {
  if (!board.value.scenes.length) return true;
  return ElMessageBox.confirm("Danh sách cảnh hiện tại sẽ được thay thế. Bạn có thể xuất một bản trước để giữ các cảnh này.", "Thay phân cảnh hiện tại?",
    { type: "warning", confirmButtonText: "Thay phân cảnh", cancelButtonText: "Giữ lại" }).then(() => true, () => false);
}

function replaceScenes(scenes: DramaScene[]) {
  board.value.scenes = scenes;
  activeId.value = scenes[0]?.id ?? "";
  sceneQuery.value = "";
  removedScene.value = undefined;
  markDirty();
}

function openHuobaoJson() {
  importError.value = "";
  try { window.open(huobaoStoryboardUrl(huobaoAddress.value, huobaoEpisode.value), "_blank", "noopener,noreferrer"); }
  catch { importError.value = "Nhập địa chỉ HTTP(S) của Huobao và ID tập hợp lệ."; }
}

function importWithKey() {
  void importJson(async () => {
    const url = new URL(huobaoStoryboardUrl(huobaoAddress.value, huobaoEpisode.value));
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("Hãy dùng địa chỉ HTTPS của Huobao hoặc địa chỉ cục bộ để gửi khóa truy cập.");
    }
    const response = await fetch(url, { headers: { "X-API-Key": huobaoKey.value.trim() }, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000) })
      .catch(() => { throw new Error("Không kết nối được với Huobao. Kiểm tra địa chỉ và quyền truy cập từ MacFlow, hoặc nhập tệp JSON."); });
    if (response.status === 401 || response.status === 403) throw new Error("Huobao từ chối khóa truy cập. Hãy hỏi người quản trị Huobao.");
    if (!response.ok) throw new Error("Không mở được tập Huobao. Hãy kiểm tra ID tập rồi thử lại.");
    if (Number(response.headers.get("content-length")) > importByteLimit) throw new Error("Dữ liệu JSON vượt 4 MiB. Hãy nhập từng tập.");
    return response.text();
  });
}

function importFile(event: Event) {
  const control = event.target as HTMLInputElement;
  const file = control.files?.[0];
  control.value = "";
  if (file) void importJson(() => {
    if (file.size > importByteLimit) throw new Error("Tệp JSON vượt 4 MiB. Hãy nhập từng tập.");
    return file.text();
  });
}

async function importJson(read: () => string | Promise<string>) {
  if (!ready.value || working.value) return;
  action.value = "import";
  const version = loadVersion;
  importError.value = "";
  try {
    const text = await read();
    if (new Blob([text]).size > importByteLimit) throw new Error("Dữ liệu JSON vượt 4 MiB. Hãy nhập từng tập.");
    const scenes = importHuobaoScenes(text);
    if (version !== loadVersion || !(await confirmReplace()) || version !== loadVersion) return;
    board.value.importNotes = importNotes.value.trim();
    replaceScenes(scenes);
    pastedJson.value = "";
    importVisible.value = false;
    ElMessage.success(`Đã nhập ${scenes.length} cảnh từ Huobao.`);
  } catch (error) { if (version === loadVersion) importError.value = errorText(error); }
  finally { action.value = undefined; huobaoKey.value = ""; }
}

async function runModel(kind: Generation["kind"], prompt: string, accept: (text: string) => string, scene?: DramaScene) {
  const model = selectedModel.value;
  if (!model || !ready.value || working.value) return;
  const controller = new AbortController();
  const deadline = AbortSignal.timeout(aiLimitSeconds * 1000);
  const signal = AbortSignal.any([controller.signal, deadline]);
  const version = loadVersion;
  const feedback = kind === "split" ? splitFeedback : translationFeedback;
  generation.value = { kind, controller, sceneId: scene?.id, label: scene?.title.trim() || "cảnh đã chọn" };
  feedback.value = undefined;
  elapsed.value = 0;
  receiving.value = false;
  const start = Date.now();
  const timer = window.setInterval(() => { elapsed.value = Math.min(aiLimitSeconds, Math.floor((Date.now() - start) / 1000)); }, 400);
  try {
    const answer = await ai.generate({ ...getNodeModelIdentity(model), directory: directory.value, prompt,
      systemPrompt: kind === "split" ? splitSystemPrompt : translateSystemPrompt, signal,
      onEvent: event => { if (event.type === "text") receiving.value = true; } });
    signal.throwIfAborted();
    if (version === loadVersion) feedback.value = { type: "success", text: accept(answer.text) };
  } catch (error) {
    if (version !== loadVersion) return;
    feedback.value = controller.signal.aborted ? { type: "info", text: kind === "split" ? "Đã dừng chia cảnh." : "Đã dừng Việt hóa cảnh." }
      : { type: "error", text: deadline.aborted
        ? "Đã hết thời gian chờ mô hình. Hãy thử lại hoặc chọn mô hình khác."
        : `AI chưa hoàn tất yêu cầu. ${errorText(error)}` };
  } finally {
    clearInterval(timer);
    if (generation.value?.controller === controller) generation.value = undefined;
  }
}

async function splitScript() {
  const script = board.value.script.trim();
  const version = loadVersion;
  if (splitDisabled.value || !(await confirmReplace()) || version !== loadVersion || splitDisabled.value) return;
  const prompt = filmReferenceNames.value.length
    ? `Tên ảnh sẵn có trong kho phim (dữ liệu): ${JSON.stringify(filmReferenceNames.value)}\n\nKịch bản:\n${script}` : script;
  await runModel("split", prompt, text => {
    const scenes = readGeneratedScenes(text);
    replaceScenes(scenes);
    return `Đã chia ${scenes.length} cảnh. Bạn có thể chỉnh từng cảnh trước khi đưa sang xưởng.`;
  });
}

function translateScene() {
  const scene = activeScene.value;
  if (!scene || translateDisabled.value) return;
  const { title, description, dialogue, duration, imagePrompt, videoPrompt } = scene;
  void runModel("translate", JSON.stringify({ title, description, dialogue, duration, imagePrompt, videoPrompt }), text => {
    const index = board.value.scenes.findIndex(item => item.id === scene.id);
    const current = board.value.scenes[index];
    if (!current) throw new Error("Cảnh đã thay đổi. Hãy chọn lại cảnh cần Việt hóa.");
    const translated = readTranslatedScene(text, current);
    const retained = promptReferences(translated.imagePrompt).names;
    const required = [...promptReferences(current.imagePrompt).names].flatMap(([key, name]) => retained.has(key) ? [] : [`@[${name}]`]);
    if (required.length) {
      const suffix = "\n" + required.join(" ");
      translated.imagePrompt = suffix.length < 10000 ? translated.imagePrompt.slice(0, 10000 - suffix.length).trimEnd() + suffix : current.imagePrompt;
    }
    board.value.scenes[index] = translated;
    markDirty();
    return `Đã Việt hóa “${scene.title.trim() || "cảnh đã chọn"}”.`;
  }, scene);
}

function addScene() {
  if (sceneListLocked.value || board.value.scenes.length >= sceneLimit) return;
  const scene = newScene(`Cảnh ${board.value.scenes.length + 1}`);
  board.value.scenes.push(scene);
  sceneQuery.value = "";
  activeId.value = scene.id;
  markDirty();
}

function updateDuration(value?: number) {
  if (!activeScene.value) return;
  activeScene.value.duration = value ?? 0;
  delete activeScene.value.durationEstimated;
  markDirty();
}

function fillSceneDurations() {
  if (sceneListLocked.value || translation.value) return;
  const scenes = board.value.scenes.filter(scene => !scene.duration && hasSceneText(scene));
  for (const scene of scenes) {
    scene.duration = estimateSceneDuration(scene);
    scene.durationEstimated = true;
  }
  if (!scenes.length) return;
  markDirty();
  ElMessage.success(`Đã ước tính thời lượng cho ${scenes.length} cảnh.`);
}

function moveScene(id: string, target: number) {
  const scenes = board.value.scenes;
  const from = scenes.findIndex(scene => scene.id === id);
  if (!canReorder.value || from < 0 || target < 0 || target >= scenes.length || from === target) return;
  const [scene] = scenes.splice(from, 1);
  scenes.splice(target, 0, scene!);
  markDirty();
}

function moveActiveScene(offset: number) {
  moveScene(activeId.value, activeIndex.value + offset);
}

function beginDrag(event: DragEvent, id: string) {
  if (!canReorder.value || !event.dataTransfer) return;
  draggedId.value = id;
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.effectAllowed = "move";
}

function dragOverScene(event: DragEvent, id: string) {
  if (!canReorder.value || !draggedId.value || id === draggedId.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  dropTarget.value = id;
}

function resetDrag() {
  draggedId.value = dropTarget.value = "";
}

function dropScene(event: DragEvent, id: string) {
  if (!draggedId.value) return;
  event.preventDefault();
  moveScene(draggedId.value, board.value.scenes.findIndex(scene => scene.id === id));
  resetDrag();
}

async function removeScene() {
  const scene = activeScene.value;
  const version = loadVersion;
  if (!scene || sceneLocked.value) return;
  const name = scene.title.trim() || "Cảnh";
  const accepted = await ElMessageBox.confirm(`Bạn có muốn bỏ “${name}” khỏi bảng phân cảnh này?`, "Bỏ cảnh?", {
    type: "warning", confirmButtonText: "Bỏ cảnh", cancelButtonText: "Giữ lại",
  }).then(() => true, () => false);
  if (!accepted || version !== loadVersion || sceneListLocked.value || translation.value?.sceneId === scene.id) return;
  const index = board.value.scenes.findIndex(item => item.id === scene.id);
  if (index < 0) return;
  const [removed] = board.value.scenes.splice(index, 1);
  removedScene.value = { scene: removed!, index };
  if (scene.id === activeId.value) activeId.value = board.value.scenes[Math.min(index, board.value.scenes.length - 1)]?.id ?? "";
  markDirty();
}

function undoRemove() {
  const removed = removedScene.value;
  if (!removed || sceneListLocked.value || board.value.scenes.length >= sceneLimit) return;
  board.value.scenes.splice(removed.index, 0, removed.scene);
  activeId.value = removed.scene.id;
  sceneQuery.value = "";
  removedScene.value = undefined;
  markDirty();
}

function thumbnailMime(path: string) {
  const extension = path.split(".").at(-1);
  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}

watch([directory, () => activeScene.value?.thumbnail], ([workspace, path], _previous, onCleanup) => {
  previewUrl.value = previewError.value = "";
  if (!workspace || !path) return;
  const lease = useWorkspaceFiles(workspace).acquireUrl(path, thumbnailMime(path));
  let current = true;
  onCleanup(() => { current = false; lease.release(); });
  void lease.url.then(url => {
    if (current) previewUrl.value = url;
  }, () => {
    if (current) previewError.value = "Không tìm thấy ảnh trong dự án. Bạn có thể tải ảnh khác.";
  });
});

async function uploadThumbnail(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  const scene = activeScene.value;
  if (!file || !scene || sceneLocked.value || uploading.value) return;
  if (file.size > 6 * 1024 * 1024) { ElMessage.warning("Chọn ảnh PNG, JPG hoặc WebP tối đa 6 MiB."); return; }
  const version = loadVersion;
  const files = useWorkspaceFiles(directory.value);
  uploading.value = true;
  try {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const tag = String.fromCharCode(...bytes);
    const extension = tag.startsWith("\x89PNG\r\n\x1a\n") ? "png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpg"
      : tag.startsWith("RIFF") && tag.slice(8) === "WEBP" ? "webp" : "";
    if (!extension) throw new Error("Chọn ảnh PNG, JPG hoặc WebP hợp lệ.");
    const path = `.macflowSceneImage.${createNodeRequestId()}.${extension}`;
    await files.write(path, file, true);
    const current = board.value.scenes.find(item => item.id === scene.id);
    if (version !== loadVersion || !current) return;
    current.thumbnail = path;
    markDirty();
    ElMessage.success("Đã thêm ảnh xem trước cho cảnh.");
  } catch (error) {
    if (version === loadVersion) ElMessage.error(`Chưa thêm được ảnh. ${errorText(error)}`);
  } finally { uploading.value = false; }
}

function removeThumbnail() {
  if (!activeScene.value || sceneLocked.value || uploading.value) return;
  delete activeScene.value.thumbnail;
  markDirty();
}

async function openStudio(kind: "image" | "video") {
  const prompt = (kind === "image" ? activeScene.value?.imagePrompt : activeScene.value?.videoPrompt)?.trim();
  const version = loadVersion;
  if (!prompt || sceneLocked.value) return;
  const label = kind === "image" ? "Xưởng ảnh" : "Xưởng video";
  const accepted = await ElMessageBox.confirm(`Prompt sẽ được điền vào ô ý tưởng của ${label}. Bạn có thể xem và sửa trước khi tạo.`,
    `Đưa sang ${label}?`, { confirmButtonText: "Mở xưởng", cancelButtonText: "Ở lại" }).then(() => true, () => false);
  if (!accepted || version !== loadVersion || !(await saveBoard())) return;
  const transfer = { directory: directory.value, kind, prompt };
  queueStudioPrompt(transfer);
  try {
    if (await router.push(`/${kind}`)) throw new Error();
  } catch {
    clearStudioPrompt(transfer);
    ElMessage.error(`Chưa mở được ${label}. Hãy thử lại.`);
  }
}

async function sendToCanvas() {
  if (outputDisabled.value || action.value) return;
  const version = loadVersion;
  const accepted = await ElMessageBox.confirm("MacFlow sẽ mở Canvas và thêm một node Văn bản chứa bảng phân cảnh hiện tại.", "Đưa bảng phân cảnh vào Canvas?",
    { confirmButtonText: "Mở Canvas", cancelButtonText: "Ở lại" }).then(() => true, () => false);
  if (!accepted || version !== loadVersion || !(await saveBoard())) return;
  const transfer: StudioMediaTransfer = { directory: directory.value, mediaType: "text",
    name: storyboardExportName(board.value.title), text: storyboardMarkdown(board.value) };
  queueStudioMediaForCanvas(transfer);
  try {
    if (await router.push("/workspace")) throw new Error();
  } catch {
    clearStudioMediaForCanvas(transfer);
    ElMessage.error("Chưa mở được Canvas. Hãy thử lại.");
  }
}

async function downloadBoard() {
  if (exportDisabled.value || downloading.value) return;
  downloading.value = true;
  const content = new Blob([storyboardMarkdown(board.value)], { type: "text/markdown;charset=utf-8" });
  try {
    const name = storyboardExportName(board.value.title);
    const saved = await saveFile(content, name);
    if (saved) ElMessage.success(`Đã xuất ${name}`);
    else ElMessage.info("Đã hủy lưu tệp Markdown.");
  } catch (error) { ElMessage.error(`Chưa tải được Markdown. ${errorText(error)}`); }
  finally { downloading.value = false; }
}

const exportDisabled = computed(() => outputDisabled.value && !board.value.script.trim() && !board.value.characters.trim() && !board.value.importNotes.trim());
const printSnapshot = ref<ReturnType<typeof emptyBoard>>();
function clearPrint() { printSnapshot.value = undefined; }

async function printBoard() {
  if (exportDisabled.value || printSnapshot.value) return;
  printSnapshot.value = readDramaBoard(JSON.stringify(board.value));
  await nextTick();
  try {
    window.addEventListener("afterprint", clearPrint, { once: true });
    window.print();
  } catch (error) {
    clearPrint();
    window.removeEventListener("afterprint", clearPrint);
    ElMessage.error(`Chưa mở được bản in. ${errorText(error)}`);
  }
}

watch([directory, boardId], () => void loadBoard(), { immediate: true });
watch(directory, () => { filmReferenceNames.value = []; void loadBoards(); }, { immediate: true });
watch(importVisible, visible => {
  if (visible) { importNotes.value = board.value.importNotes; importError.value = ""; }
  else huobaoKey.value = "";
});
watch(visibleScenes, scenes => {
  if (!scenes.some(({ scene }) => scene.id === activeId.value)) activeId.value = scenes[0]?.scene.id ?? "";
});
onMounted(() => void loadModels());
onScopeDispose(() => {
  loadVersion++;
  boardListVersion++;
  generation.value?.controller.abort();
  window.removeEventListener("afterprint", clearPrint);
});

async function confirmLeave() {
  if (action.value) return false;
  if (!dirty.value || draftStored.value) return true;
  return ElMessageBox.confirm("Bảng phân cảnh còn thay đổi chưa lưu.", "Rời bảng phân cảnh?",
    { type: "warning", confirmButtonText: "Rời bảng", cancelButtonText: "Tiếp tục chỉnh" }).then(() => true, () => false);
}
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate((to, from) => storyboardId(to.query.board) === storyboardId(from.query.board) || confirmLeave());
</script>

<style scoped>
.dramaPage { display: grid; grid-template-columns: 226px minmax(0, 1fr); height: 100dvh; color: var(--el-text-color-primary); background: var(--el-bg-color-page); }
.navRail { overflow: auto; padding: 20px 14px; background: var(--el-bg-color); border-inline-end: 1px solid var(--el-border-color-light); }
.brand { display: flex; align-items: center; gap: 11px; margin: 0 8px 20px; font-size: 20px; }
.brand img { width: 31px; height: 31px; }
.dramaMain { overflow: auto; padding: clamp(16px, 3vw, 34px); }
.pageHeader, .workArea, .notice, .viewActions { max-width: 1500px; margin-inline: auto; }
.viewActions { margin-bottom: 15px; }
.pageHeader { display: flex; justify-content: space-between; flex-wrap: wrap; align-items: end; gap: 14px; margin-bottom: 18px; }
.pageHeader h1 { margin: 4px 0 6px; font-size: clamp(25px, 3vw, 34px); line-height: 1.2; }
.pageHeader p { margin: 0; color: var(--el-text-color-regular); }
.sectionLink { color: var(--el-text-color-primary); text-underline-offset: 4px; }
.boardActions, .saveGroup { display: grid; align-items: start; justify-items: end; gap: 7px; }
.boardPicker { width: min(215px, 100%); }
.saveStatus { font-size: 13px; font-weight: 550; }
.workArea { display: grid; grid-template-columns: minmax(280px, .9fr) minmax(0, 1.4fr); gap: 15px; align-items: stretch; }
.scriptCard, .sceneCard { min-width: 0; border-radius: 13px; }
.sceneCard { display: flex; flex-direction: column; }
.sceneCard :deep(.el-card__body) { display: flex; flex: 1; flex-direction: column; min-width: 0; gap: 14px; }
.scriptCard h2, .sceneCard h2 { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 17px; }
.sceneHeader, .buttonRow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.sceneHeader { justify-content: space-between; }
.sceneCount { padding: 2px 8px; border-radius: 6px; background: var(--el-fill-color); font-size: 13px; }
.sceneHeader .sceneTotal { margin-top: 3px; }
.formFields, .sceneBody { display: grid; gap: 12px; min-width: 0; }
.dramaField { display: grid; gap: 6px; min-width: 0; font-size: 14px; font-weight: 620; }
.dramaField :deep(input::placeholder), .dramaField :deep(textarea::placeholder), .sceneFinder :deep(input::placeholder) { color: var(--el-text-color-regular); opacity: 1; }
.modelGroup, .outputBar { margin-top: auto; padding-top: 13px; border-top: 1px solid var(--el-border-color-light); }
.outputBar { display: grid; gap: 8px; }
.sceneTimeline { display: flex; flex-wrap: wrap; gap: 6px; max-height: 172px; overflow-y: auto; padding: 3px 3px 8px; }
.sceneTab { display: flex; align-items: center; flex: 0 0 auto; max-width: min(205px, 100%); border: 1px solid var(--el-border-color); border-radius: 7px; background: var(--el-fill-color-lighter); color: var(--el-text-color-regular); }
.sceneTab.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-text-color-primary); }
.sceneTab.dropTarget { box-shadow: -3px 0 var(--el-color-primary); }
.sceneTab button { display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 36px; padding: 4px 8px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.sceneTab button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.dragHandle { padding: 6px 0 6px 8px; cursor: grab; }
.sceneIndex { padding: 2px 4px; border-radius: 4px; background: var(--el-bg-color); font-weight: 650; }
.sceneTitle { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sceneFinder { display: grid; gap: 6px; }
.sceneDetails, .promptGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.promptPanel, .scenePreview, .aiStatus, .undoBar { min-width: 0; padding: 10px; border-radius: 9px; background: var(--el-fill-color-light); }
.promptPanel, .aiStatus { display: grid; align-content: start; gap: 8px; }
.promptPanel :deep(.el-button), .aiStatus :deep(.el-button) { justify-self: start; }
.scenePreview { display: flex; align-items: center; gap: 12px; }
.scenePreview img { display: block; width: clamp(70px, 14vw, 125px); aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; }
.undoBar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 14px; }
.aiStatus p, .undoBar p { margin: 0; }
.aiStatus p { font-size: 14px; font-weight: 600; }
.sceneEmpty { padding: 22px 10px; font-size: 14px; }
.sceneEmpty h3, .emptySearch { margin: 0; font-weight: 620; }
.sceneEmpty ol { margin: 8px 0 16px; padding-inline-start: 24px; line-height: 1.6; }
.sceneEmpty li + li { margin-top: 7px; }
.buttonRow :deep(.el-button) { margin-left: 0; max-width: 100%; height: auto; min-height: 32px; white-space: normal; }
.buttonRow :deep(.el-button.is-disabled) { background: var(--el-fill-color-light); border-color: var(--el-border-color-light); color: var(--el-text-color-secondary); opacity: .75; }
.notice { margin-bottom: 14px; }
.hint, .fieldError { margin: 0; font-size: 13px; font-weight: 450; line-height: 1.5; color: var(--el-text-color-regular); }
.fieldError { color: var(--el-color-danger); }
.guide { padding: 8px 10px; border: 1px solid var(--el-border-color-light); border-radius: 8px; font-size: 13px; line-height: 1.5; }
.guide summary { font-weight: 600; cursor: pointer; }
.guide .el-button, .guide .el-input, .guide .dramaField { margin-top: 8px; }
@media (max-width: 1120px) { .workArea { grid-template-columns: minmax(250px, .85fr) minmax(0, 1.15fr); } }
@media (max-width: 1050px) {
  .dramaPage { grid-template-columns: 68px minmax(0, 1fr); }
  .navRail { padding: 9px 6px; }
  .brand { justify-content: center; margin: 0 0 12px; }
  .brand strong { display: none; }
}
@media (max-width: 760px) {
  .workArea, .promptGrid { grid-template-columns: minmax(0, 1fr); }
  .boardActions, .saveGroup { justify-items: start; }
}
@media (max-width: 730px) {
  .dramaPage { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .navRail { border-inline-end: 0; border-bottom: 1px solid var(--el-border-color-light); }
  .brand { display: none; }
}
@media (max-width: 390px) { .sceneDetails { grid-template-columns: minmax(0, 1fr); } }
</style>

<style>
.macflowStoryboardPrint { display: none; }
@media print {
  body:has(> .macflowStoryboardPrint) { overflow: visible !important; display: block !important; }
  body:has(> .macflowStoryboardPrint) > :not(.macflowStoryboardPrint) { display: none !important; }
  .macflowStoryboardPrint { display: block; padding: 12mm; color: #111; background: #fff; font: 11pt/1.45 sans-serif; overflow-wrap: anywhere; }
  .macflowStoryboardPrint h1 { margin: 0 0 14pt; font-size: 20pt; }
  .macflowStoryboardPrint h2 { margin: 16pt 0 6pt; font-size: 14pt; break-after: avoid; }
  .macflowStoryboardPrint p { margin: 0 0 7pt; white-space: pre-wrap; orphans: 2; widows: 2; }
}
</style>
