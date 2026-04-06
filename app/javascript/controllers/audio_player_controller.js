import { Controller } from "@hotwired/stimulus";
import { Icons } from "./icons";
import WaveSurfer from "wavesurfer.js";

export default class extends Controller {
    static targets = ["waveform", "playButton", "currentTime", "duration", "volumeButton", "volumeSlider", "trackTitle", "trackArtist", "trackImage"];
    connect() {
        console.log("WaveSurfer инициализирован!");
        this.isPlaying = false;
        this.currentTrack = null;

        this.playButtonTarget.innerHTML = Icons.play;
        this.volumeButtonTarget.innerHTML = Icons.highSound;

        // Инициализируем WaveSurfer с настройками
        this.wavesurfer = WaveSurfer.create({
            container: this.waveformTarget,
            waveColor: '#4F4A85',
            progressColor: '#383351',
            cursorColor: '#7C6E9E',
            barWidth: 1,
            barRadius: 3,
            cursorWidth: 1,
            height: 100,
            normalize: true,
            responsive: true,
        });

        const savedVolume = this.getSavedVolume();

        // Настройка обработчиков событий
        this.setupEventListeners();
        // Устанавливаем начальную громкость
        this.setVolume(null, savedVolume);
        document.addEventListener('play-track', this.handlePlayTrack.bind(this));
    }

    handlePlayTrack(event) {
        const { url, name, artist, image } = event.detail;
        this.loadTrack(url, name, artist, image);
    }
    disconnect() {
        document.removeEventListener('play-track', this.handlePlayTrack.bind(this));
        if (this.wavesurfer) {
            this.wavesurfer.destroy();
        }
    }

    setupEventListeners() {
        // При загрузке трека
        this.wavesurfer.on('ready', () => {
            const duration = this.wavesurfer.getDuration();
            this.durationTarget.textContent = this.formatTime(duration);

            if (this.currentTrack) {
                this.trackTitleTarget.textContent = this.currentTrack.title;
                this.trackImageTarget.src = this.currentTrack.image;
                this.trackArtistTarget.textContent = this.currentTrack.artist || "Unknown Artist";
            }
        });

        // Обновление времени при воспроизведении
        this.wavesurfer.on('audioprocess', () => {
            const currentTime = this.wavesurfer.getCurrentTime();
            this.currentTimeTarget.textContent = this.formatTime(currentTime);
        });

        // При завершении трека
        this.wavesurfer.on('finish', () => {
            this.isPlaying = false;
            this.playButtonTarget.innerHTML = Icons.play;
        });

        // При клике на волновую форму
        this.wavesurfer.on('interaction', () => {
            this.currentTimeTarget.textContent = this.formatTime(this.wavesurfer.getCurrentTime());
        });
    }

    // Загрузка трека (вызывается извне)
    async loadTrack(trackUrl, trackName, trackArtist, trackImage) {
        if (this.wavesurfer) {
            this.currentTrack = {
                title: trackName,
                artist: trackArtist,
                image: trackImage
            };
            await this.wavesurfer.load(trackUrl);

            if(this.isPlaying) {
                this.wavesurfer.play();
                this.playButtonTarget.innerHTML = Icons.pause;
            }

        }
    }

    // Play/Pause
    playPause() {
        if (!this.wavesurfer) return;

        if (this.isPlaying) {
            this.wavesurfer.pause();
            this.playButtonTarget.innerHTML = Icons.play;
            this.isPlaying = false;
        } else {
            this.wavesurfer.play();
            this.playButtonTarget.innerHTML = Icons.pause;
            this.isPlaying = true;
        }
    }

    // Управление громкостью
    setVolume(event, volume) {
        if (this.wavesurfer) {
            if (event !== null) {
                volume = parseFloat(event.target.value) / 100;
            }
            this.saveVolume(volume);
            this.wavesurfer.setVolume(volume);
            this.volumeSliderTarget.value = volume * 100;
            // Меняем иконку в зависимости от громкости
            if (volume === 0) {
                this.volumeButtonTarget.innerHTML = Icons.offSound;
            } else if (volume < 0.3) {
                this.volumeButtonTarget.innerHTML = Icons.lowSound;
            } else {
                this.volumeButtonTarget.innerHTML = Icons.highSound;
            }
        }
    }

    // Mute/Unmute
    toggleMute() {
        if (this.wavesurfer) {
            const currentVolume = this.wavesurfer.getVolume();

            if (currentVolume > 0) {
                this.lastVolume = currentVolume;
                this.setVolume(null, 0);
            } else {
                const newVolume = this.lastVolume || 0.7;
                this.setVolume(null, newVolume);
            }
        }
    }

    // Форматирование времени
    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    saveVolume(volume) {
        console.log("Saved volume: " + volume)
        localStorage.setItem('audio-player-volume', volume);
    }

    getSavedVolume() {
        const saved = localStorage.getItem('audio-player-volume');
        console.log("Get volume" + saved)
        if (saved !== null) {
            const volume = parseFloat(saved);
            if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                return volume;
            }
        }
        return 0.7;
    }
}