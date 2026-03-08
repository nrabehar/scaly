import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as natural from 'natural';
import * as path from 'path';
import { TrainData } from './constants/train.data';
import { INewClassificationResult } from './news.types';

@Injectable()
export class NewsClassifier implements OnModuleInit {
    private readonly logger = new Logger(NewsClassifier.name);
    private classifier: natural.BayesClassifier;
    private modelPath = path.join(__dirname, './model.json');

    async onModuleInit() {
        await new Promise<void>((resolve) => {
            natural.BayesClassifier.load(
                this.modelPath,
                null,
                (err, classifier) => {
                    if (err || !classifier) {
                        this.logger.warn(
                            'No saved model found — training from scratch...',
                        );
                        this.classifier = new natural.BayesClassifier();
                        this.trainAndSave();
                    } else {
                        this.classifier = classifier;
                        this.logger.log('Classifier loaded successfully');
                    }
                    resolve();
                },
            );
        });
    }

    classify(text: string): INewClassificationResult {
        if (!this.classifier) {
            this.logger.warn('Classifier not ready — returning NEUTRAL');
            return { label: 'NEUTRAL', confidence: 0 };
        }

        const prediction = this.classifier.classify(text);
        const proportions = this.classifier.getClassifications(text);

        // getClassifications() returns raw Bayes scores (products of likelihoods),
        // which are tiny absolute numbers. Normalize so confidence is in [0, 1].
        const total = proportions.reduce((sum, p) => sum + p.value, 0);
        const rawScore =
            proportions.find((p) => p.label === prediction)?.value ?? 0;
        const confidence = total > 0 ? rawScore / total : 0;

        return { label: prediction, confidence };
    }

    private trainAndSave() {
        for (const [label, docs] of Object.entries(TrainData)) {
            docs.forEach((doc) => {
                this.classifier.addDocument(doc, label);
            });
        }
        this.classifier.train();
        this.classifier.save(this.modelPath, (err) => {
            if (!err)
                this.logger.log('Classifier trained and saved successfully');
            else this.logger.error('Error saving classifier:', err);
        });
    }
}
