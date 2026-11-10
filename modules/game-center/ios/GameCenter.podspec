Pod::Spec.new do |s|
  s.name           = 'GameCenter'
  s.version        = '1.0.0'
  s.summary        = 'Game Center sign-in and identity proofs for SketchDuel'
  s.description    = 'Signs the local player into Game Center and returns a server-verifiable identity proof.'
  s.author         = 'SketchDuel'
  s.homepage       = 'https://sketchduel.app'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
