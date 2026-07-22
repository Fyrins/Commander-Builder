<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Vérifie un token hCaptcha auprès de l'endpoint siteverify. Volontairement
 * minimal : notre front est une SPA JSON, on n'a besoin ni du bundle
 * Form/Twig ni de PSR-7 — juste un appel HTTP serveur-à-serveur.
 */
class HcaptchaVerifier
{
    private const VERIFY_URL = 'https://hcaptcha.com/siteverify';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly string $hcaptchaSecret,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function verify(?string $token, ?string $remoteIp = null): bool
    {
        if ($token === null || $token === '') {
            return false;
        }

        $body = ['secret' => $this->hcaptchaSecret, 'response' => $token];
        if ($remoteIp !== null) {
            $body['remoteip'] = $remoteIp;
        }

        try {
            $response = $this->httpClient->request('POST', self::VERIFY_URL, [
                'body' => $body,
                'timeout' => 10,
            ]);
            $data = $response->toArray(false);
        } catch (\Throwable $exception) {
            // Un hCaptcha injoignable ne doit pas ouvrir une faille silencieuse :
            // on refuse par défaut, l'utilisateur pourra réessayer.
            $this->logger->warning('hCaptcha injoignable, vérification refusée par défaut.', [
                'exception' => $exception->getMessage(),
            ]);

            return false;
        }

        return ($data['success'] ?? false) === true;
    }
}
